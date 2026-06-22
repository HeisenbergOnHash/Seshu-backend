import {
  toCalendarDate,
  calendarDaysDiff,
  parseCalendarDate
} from '../utils/dates';

export type InterestType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface TransactionRecord {
  date: Date;
  type: 'CREDIT' | 'DEBIT' | 'INTEREST_COLLECTION' | 'CHARGE';
  amount: number;
}

export interface RateLog {
  interestRate: number;
  interestRateType: 'PERCENTAGE' | 'FIXED';
  effectiveDate: Date;
}

export interface InterestResult {
  totalPrincipal: number;
  totalInterestAccrued: number;
  totalInterestCollected: number;
  totalCharges: number;
  currentOutstandingPrincipal: number;
  currentOutstandingInterest: number;
  totalPayable: number;
  daysElapsed: number;
}

export interface TransactionBalance {
  principal: number;
  interest: number;
  charges: number;
  totalPayable: number;
  interestDays: number;
}

interface SimulationState {
  currentPrincipal: number;
  totalInterestAccrued: number;
  totalInterestCollected: number;
  totalCharges: number;
}

const roundAmount = (value: number) => Math.round(value * 1000) / 1000;

export const getAccrualEndDate = (asOf?: Date): Date => {
  return toCalendarDate(asOf ?? new Date()).toDate();
};

export const calculateTermDays = (startDate: Date, dueDate?: Date | null): number | null => {
  if (!dueDate) return null;
  return calendarDaysDiff(startDate, dueDate);
};

const buildResult = (
  principal: number,
  state: SimulationState,
  loanStart: ReturnType<typeof toCalendarDate>,
  finalDate: ReturnType<typeof toCalendarDate>
): InterestResult => {
  const currentOutstandingInterest = state.totalInterestAccrued - state.totalInterestCollected;

  return {
    totalPrincipal: principal,
    totalInterestAccrued: roundAmount(state.totalInterestAccrued),
    totalInterestCollected: roundAmount(state.totalInterestCollected),
    totalCharges: roundAmount(state.totalCharges),
    currentOutstandingPrincipal: roundAmount(state.currentPrincipal),
    currentOutstandingInterest: roundAmount(currentOutstandingInterest),
    totalPayable: roundAmount(state.currentPrincipal + currentOutstandingInterest + state.totalCharges),
    daysElapsed: finalDate.diff(loanStart, 'day')
  };
};

const toBalance = (state: SimulationState, interestDays: number): TransactionBalance => {
  const interest = state.totalInterestAccrued - state.totalInterestCollected;
  return {
    principal: roundAmount(state.currentPrincipal),
    interest: roundAmount(interest),
    charges: roundAmount(state.totalCharges),
    totalPayable: roundAmount(state.currentPrincipal + interest + state.totalCharges),
    interestDays
  };
};

const simulateInterest = (
  principal: number,
  type: InterestType,
  startDate: Date,
  endDate: Date,
  transactions: TransactionRecord[],
  rateLogs: RateLog[]
): InterestResult => {
  const sortedTx = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sortedRates = [...rateLogs].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());

  const state: SimulationState = {
    currentPrincipal: principal,
    totalInterestAccrued: 0,
    totalInterestCollected: 0,
    totalCharges: 0
  };

  const loanStart = toCalendarDate(startDate);
  let lastDate = loanStart;
  const finalDate = toCalendarDate(endDate);

  const getActiveRate = (date: ReturnType<typeof toCalendarDate>) => {
    let activeLog = sortedRates[0];
    for (const log of sortedRates) {
      if (toCalendarDate(log.effectiveDate).isAfter(date)) break;
      activeLog = log;
    }
    return activeLog;
  };

  const calcDailyInterest = (principalAmt: number, date: ReturnType<typeof toCalendarDate>) => {
    const rateLog = getActiveRate(date);
    const { interestRate, interestRateType } = rateLog;

    if (interestRateType === 'PERCENTAGE') {
      let dailyRateDecimal = 0;
      if (type === 'DAILY') dailyRateDecimal = interestRate / 100;
      else if (type === 'WEEKLY') dailyRateDecimal = (interestRate / 100) / 7;
      else if (type === 'MONTHLY') dailyRateDecimal = (interestRate / 100) / 30;
      return principalAmt * dailyRateDecimal;
    }

    if (type === 'DAILY') return interestRate;
    if (type === 'WEEKLY') return interestRate / 7;
    if (type === 'MONTHLY') return interestRate / 30;
    return 0;
  };

  const accrueForDays = (fromDate: ReturnType<typeof toCalendarDate>, toDate: ReturnType<typeof toCalendarDate>) => {
    const daysDiff = toDate.diff(fromDate, 'day');
    if (daysDiff <= 0) return;

    for (let i = 0; i < daysDiff; i++) {
      const currentDate = fromDate.add(i, 'day');
      if (currentDate.isAfter(finalDate)) break;
      state.totalInterestAccrued += calcDailyInterest(state.currentPrincipal, currentDate);
    }
  };

  const applyTransaction = (tx: TransactionRecord) => {
    if (tx.type === 'DEBIT') {
      state.currentPrincipal -= tx.amount;
      if (state.currentPrincipal < 0) state.currentPrincipal = 0;
    } else if (tx.type === 'CREDIT') {
      state.currentPrincipal += tx.amount;
    } else if (tx.type === 'INTEREST_COLLECTION') {
      state.totalInterestCollected += tx.amount;
    } else if (tx.type === 'CHARGE') {
      state.totalCharges += tx.amount;
    }
  };

  for (const tx of sortedTx) {
    const txDate = toCalendarDate(tx.date);
    if (txDate.isBefore(loanStart)) continue;

    const accrueUntil = txDate.isAfter(finalDate) ? finalDate : txDate;

    if (!lastDate.isAfter(finalDate)) {
      accrueForDays(lastDate, accrueUntil);
      lastDate = accrueUntil;
    }

    applyTransaction(tx);
  }

  if (!lastDate.isAfter(finalDate)) {
    accrueForDays(lastDate, finalDate);
  }

  return buildResult(principal, state, loanStart, finalDate);
};

export const calculateInterest = (
  principal: number,
  type: InterestType,
  startDate: Date,
  endDate: Date,
  transactions: TransactionRecord[],
  rateLogs: RateLog[]
): InterestResult => {
  return simulateInterest(principal, type, startDate, endDate, transactions, rateLogs);
};

export const calculateRunningBalances = (
  principal: number,
  type: InterestType,
  startDate: Date,
  transactions: TransactionRecord[],
  rateLogs: RateLog[],
  dueDate?: Date | null
): TransactionBalance[] => {
  if (transactions.length === 0) return [];

  const sortedTx = transactions;
  const sortedRates = [...rateLogs].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());

  const state: SimulationState = {
    currentPrincipal: principal,
    totalInterestAccrued: 0,
    totalInterestCollected: 0,
    totalCharges: 0
  };

  const loanStart = toCalendarDate(startDate);
  const dueDateCal = dueDate ? toCalendarDate(dueDate) : null;
  let lastDate = loanStart;
  let totalAccruedDays = 0;
  const snapshots: TransactionBalance[] = [];

  const getActiveRate = (date: ReturnType<typeof toCalendarDate>) => {
    let activeLog = sortedRates[0];
    for (const log of sortedRates) {
      if (toCalendarDate(log.effectiveDate).isAfter(date)) break;
      activeLog = log;
    }
    return activeLog;
  };

  const calcDailyInterest = (principalAmt: number, date: ReturnType<typeof toCalendarDate>) => {
    const rateLog = getActiveRate(date);
    const { interestRate, interestRateType } = rateLog;

    if (interestRateType === 'PERCENTAGE') {
      let dailyRateDecimal = 0;
      if (type === 'DAILY') dailyRateDecimal = interestRate / 100;
      else if (type === 'WEEKLY') dailyRateDecimal = (interestRate / 100) / 7;
      else if (type === 'MONTHLY') dailyRateDecimal = (interestRate / 100) / 30;
      return principalAmt * dailyRateDecimal;
    }

    if (type === 'DAILY') return interestRate;
    if (type === 'WEEKLY') return interestRate / 7;
    if (type === 'MONTHLY') return interestRate / 30;
    return 0;
  };

  const accrueForDays = (fromDate: ReturnType<typeof toCalendarDate>, toDate: ReturnType<typeof toCalendarDate>) => {
    const daysDiff = toDate.diff(fromDate, 'day');
    if (daysDiff <= 0) return 0;

    for (let i = 0; i < daysDiff; i++) {
      state.totalInterestAccrued += calcDailyInterest(state.currentPrincipal, fromDate.add(i, 'day'));
    }
    return daysDiff;
  };

  for (const tx of sortedTx) {
    const txDate = toCalendarDate(tx.date);

    if (!txDate.isBefore(loanStart)) {
      let accrueUntil = txDate;
      if (dueDateCal && dueDateCal.isBefore(txDate)) {
        accrueUntil = dueDateCal;
      }
      if (!lastDate.isAfter(accrueUntil)) {
        totalAccruedDays += accrueForDays(lastDate, accrueUntil);
        lastDate = accrueUntil;
      }
    }

    if (tx.type === 'DEBIT') {
      state.currentPrincipal -= tx.amount;
      if (state.currentPrincipal < 0) state.currentPrincipal = 0;
    } else if (tx.type === 'CREDIT') {
      state.currentPrincipal += tx.amount;
    } else if (tx.type === 'INTEREST_COLLECTION') {
      state.totalInterestCollected += tx.amount;
    } else if (tx.type === 'CHARGE') {
      state.totalCharges += tx.amount;
    }

    snapshots.push(toBalance(state, totalAccruedDays));
  }

  return snapshots;
};

// Re-export for controllers parsing form dates
export { parseCalendarDate };
