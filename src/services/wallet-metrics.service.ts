import {
  calculateInterest,
  getAccrualEndDate,
  InterestType,
  RateLog,
  TransactionRecord
} from './interest.service';

export type WalletTransactionType =
  | 'CREDIT'
  | 'DEBIT'
  | 'INTEREST_COLLECTION'
  | 'CHARGE';

export interface WalletTransaction {
  type: string;
  amount: number;
  createdAt?: Date;
}

export interface WalletLoanInput {
  status: string;
  principal: number;
  interestType: string;
  startDate: Date;
  transactions: WalletTransaction[];
  rateLogs: RateLog[];
}

export interface TransactionMetrics {
  totalCollections: number;
  interestEarned: number;
  creditDisbursements: number;
}

const roundAmount = (value: number) => Math.round(value * 1000) / 1000;

export const getWalletLoanScope = (userId: string) => ({
  createdById: userId
});

export const getDashboardLoanScope = (role: string, userId: string) =>
  role === 'ADMIN' ? {} : { createdById: userId };

export const aggregateTransactionMetrics = (
  transactions: WalletTransaction[]
): TransactionMetrics => {
  let totalCollections = 0;
  let interestEarned = 0;
  let creditDisbursements = 0;

  for (const tx of transactions) {
    if (tx.type === 'INTEREST_COLLECTION') {
      interestEarned += tx.amount;
      totalCollections += tx.amount;
    } else if (tx.type === 'DEBIT' || tx.type === 'CHARGE') {
      totalCollections += tx.amount;
    } else if (tx.type === 'CREDIT') {
      creditDisbursements += tx.amount;
    }
  }

  return {
    totalCollections: roundAmount(totalCollections),
    interestEarned: roundAmount(interestEarned),
    creditDisbursements: roundAmount(creditDisbursements)
  };
};

export const calculateTotalDisbursements = (loans: WalletLoanInput[]): number => {
  let total = 0;

  for (const loan of loans) {
    const creditSum = loan.transactions
      .filter((tx) => tx.type === 'CREDIT')
      .reduce((acc, tx) => acc + tx.amount, 0);

    total += creditSum > 0 ? creditSum : loan.principal;
  }

  return roundAmount(total);
};

/** @deprecated use calculateTotalDisbursements */
export const calculateImplicitDisbursements = (loans: WalletLoanInput[]): number => {
  let implicit = 0;

  for (const loan of loans) {
    if (loan.status !== 'ACTIVE' && loan.status !== 'DEFAULTED') continue;
    const hasCreditTx = loan.transactions.some((tx) => tx.type === 'CREDIT');
    if (!hasCreditTx) {
      implicit += loan.principal;
    }
  }

  return roundAmount(implicit);
};

export const calculateAvailableBalance = (
  openingBalance: number,
  totalDisbursements: number,
  totalCollections: number
): number => {
  return roundAmount(openingBalance - totalDisbursements + totalCollections);
};

export const calculateOutstandingPrincipal = (
  loans: WalletLoanInput[],
  accrualEnd: Date = getAccrualEndDate()
): number => {
  let totalAssets = 0;

  for (const loan of loans) {
    if (loan.status !== 'ACTIVE' && loan.status !== 'DEFAULTED') continue;

    const txRecords: TransactionRecord[] = loan.transactions.map((tx) => ({
      date: tx.createdAt ?? new Date(),
      type: tx.type as WalletTransactionType,
      amount: tx.amount
    }));

    const interestInfo = calculateInterest(
      loan.principal,
      loan.interestType as InterestType,
      loan.startDate,
      accrualEnd,
      txRecords,
      loan.rateLogs
    );

    totalAssets += interestInfo.currentOutstandingPrincipal;
  }

  return roundAmount(totalAssets);
};

export const buildWalletMetrics = (
  openingBalance: number,
  loans: WalletLoanInput[],
  accrualEnd: Date = getAccrualEndDate()
) => {
  const allTransactions = loans.flatMap((loan) => loan.transactions);
  const { totalCollections, interestEarned, creditDisbursements } =
    aggregateTransactionMetrics(allTransactions);
  const totalDisbursements = calculateTotalDisbursements(loans);
  const totalAssets = calculateOutstandingPrincipal(loans, accrualEnd);
  const balance = calculateAvailableBalance(
    openingBalance,
    totalDisbursements,
    totalCollections
  );

  return {
    balance,
    totalAssets,
    totalCollections,
    interestEarned,
    creditDisbursements,
    totalDisbursements
  };
};
