"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCalendarDate = exports.calculateRunningBalances = exports.calculateInterest = exports.calculateTermDays = exports.getAccrualEndDate = void 0;
const dates_1 = require("../utils/dates");
Object.defineProperty(exports, "parseCalendarDate", { enumerable: true, get: function () { return dates_1.parseCalendarDate; } });
const roundAmount = (value) => Math.round(value * 1000) / 1000;
const DEFAULT_RATE_LOG = {
    interestRate: 0,
    interestRateType: 'FIXED'
};
const getAccrualEndDate = (asOf) => {
    return (0, dates_1.toCalendarDate)(asOf ?? new Date()).toDate();
};
exports.getAccrualEndDate = getAccrualEndDate;
const calculateTermDays = (startDate, dueDate) => {
    if (!dueDate)
        return null;
    return (0, dates_1.calendarDaysDiff)(startDate, dueDate);
};
exports.calculateTermDays = calculateTermDays;
const buildResult = (principal, state, loanStart, finalDate) => {
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
const toBalance = (state, interestDays) => {
    const interest = state.totalInterestAccrued - state.totalInterestCollected;
    return {
        principal: roundAmount(state.currentPrincipal),
        interest: roundAmount(interest),
        charges: roundAmount(state.totalCharges),
        totalPayable: roundAmount(state.currentPrincipal + interest + state.totalCharges),
        interestDays
    };
};
const simulateInterest = (principal, type, startDate, endDate, transactions, rateLogs) => {
    const sortedTx = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    const sortedRates = [...rateLogs].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
    const state = {
        currentPrincipal: principal,
        totalInterestAccrued: 0,
        totalInterestCollected: 0,
        totalCharges: 0
    };
    const loanStart = (0, dates_1.toCalendarDate)(startDate);
    let lastDate = loanStart;
    const finalDate = (0, dates_1.toCalendarDate)(endDate);
    const effectiveRates = sortedRates.length > 0
        ? sortedRates
        : [{ ...DEFAULT_RATE_LOG, effectiveDate: startDate }];
    const getActiveRate = (date) => {
        let activeLog = effectiveRates[0];
        for (const log of effectiveRates) {
            if ((0, dates_1.toCalendarDate)(log.effectiveDate).isAfter(date))
                break;
            activeLog = log;
        }
        return activeLog;
    };
    const calcDailyInterest = (principalAmt, date) => {
        const rateLog = getActiveRate(date);
        const { interestRate, interestRateType } = rateLog;
        if (interestRateType === 'PERCENTAGE') {
            let dailyRateDecimal = 0;
            if (type === 'DAILY')
                dailyRateDecimal = interestRate / 100;
            else if (type === 'WEEKLY')
                dailyRateDecimal = (interestRate / 100) / 7;
            else if (type === 'MONTHLY')
                dailyRateDecimal = (interestRate / 100) / 30;
            return principalAmt * dailyRateDecimal;
        }
        if (type === 'DAILY')
            return interestRate;
        if (type === 'WEEKLY')
            return interestRate / 7;
        if (type === 'MONTHLY')
            return interestRate / 30;
        return 0;
    };
    const accrueForDays = (fromDate, toDate) => {
        const daysDiff = toDate.diff(fromDate, 'day');
        if (daysDiff <= 0)
            return;
        for (let i = 0; i < daysDiff; i++) {
            const currentDate = fromDate.add(i, 'day');
            if (currentDate.isAfter(finalDate))
                break;
            state.totalInterestAccrued += calcDailyInterest(state.currentPrincipal, currentDate);
        }
    };
    const applyTransaction = (tx) => {
        if (tx.type === 'DEBIT') {
            state.currentPrincipal -= tx.amount;
            if (state.currentPrincipal < 0)
                state.currentPrincipal = 0;
        }
        else if (tx.type === 'CREDIT') {
            state.currentPrincipal += tx.amount;
        }
        else if (tx.type === 'INTEREST_COLLECTION') {
            state.totalInterestCollected += tx.amount;
        }
        else if (tx.type === 'CHARGE') {
            state.totalCharges += tx.amount;
        }
    };
    for (const tx of sortedTx) {
        const txDate = (0, dates_1.toCalendarDate)(tx.date);
        if (txDate.isBefore(loanStart))
            continue;
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
const calculateInterest = (principal, type, startDate, endDate, transactions, rateLogs) => {
    return simulateInterest(principal, type, startDate, endDate, transactions, rateLogs);
};
exports.calculateInterest = calculateInterest;
const calculateRunningBalances = (principal, type, startDate, transactions, rateLogs, dueDate) => {
    if (transactions.length === 0)
        return [];
    const sortedTx = transactions;
    const sortedRates = [...rateLogs].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
    const state = {
        currentPrincipal: principal,
        totalInterestAccrued: 0,
        totalInterestCollected: 0,
        totalCharges: 0
    };
    const loanStart = (0, dates_1.toCalendarDate)(startDate);
    const dueDateCal = dueDate ? (0, dates_1.toCalendarDate)(dueDate) : null;
    let lastDate = loanStart;
    let totalAccruedDays = 0;
    const snapshots = [];
    const effectiveRates = sortedRates.length > 0
        ? sortedRates
        : [{ ...DEFAULT_RATE_LOG, effectiveDate: startDate }];
    const getActiveRate = (date) => {
        let activeLog = effectiveRates[0];
        for (const log of effectiveRates) {
            if ((0, dates_1.toCalendarDate)(log.effectiveDate).isAfter(date))
                break;
            activeLog = log;
        }
        return activeLog;
    };
    const calcDailyInterest = (principalAmt, date) => {
        const rateLog = getActiveRate(date);
        const { interestRate, interestRateType } = rateLog;
        if (interestRateType === 'PERCENTAGE') {
            let dailyRateDecimal = 0;
            if (type === 'DAILY')
                dailyRateDecimal = interestRate / 100;
            else if (type === 'WEEKLY')
                dailyRateDecimal = (interestRate / 100) / 7;
            else if (type === 'MONTHLY')
                dailyRateDecimal = (interestRate / 100) / 30;
            return principalAmt * dailyRateDecimal;
        }
        if (type === 'DAILY')
            return interestRate;
        if (type === 'WEEKLY')
            return interestRate / 7;
        if (type === 'MONTHLY')
            return interestRate / 30;
        return 0;
    };
    const accrueForDays = (fromDate, toDate) => {
        const daysDiff = toDate.diff(fromDate, 'day');
        if (daysDiff <= 0)
            return 0;
        for (let i = 0; i < daysDiff; i++) {
            state.totalInterestAccrued += calcDailyInterest(state.currentPrincipal, fromDate.add(i, 'day'));
        }
        return daysDiff;
    };
    for (const tx of sortedTx) {
        const txDate = (0, dates_1.toCalendarDate)(tx.date);
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
            if (state.currentPrincipal < 0)
                state.currentPrincipal = 0;
        }
        else if (tx.type === 'CREDIT') {
            state.currentPrincipal += tx.amount;
        }
        else if (tx.type === 'INTEREST_COLLECTION') {
            state.totalInterestCollected += tx.amount;
        }
        else if (tx.type === 'CHARGE') {
            state.totalCharges += tx.amount;
        }
        snapshots.push(toBalance(state, totalAccruedDays));
    }
    return snapshots;
};
exports.calculateRunningBalances = calculateRunningBalances;
