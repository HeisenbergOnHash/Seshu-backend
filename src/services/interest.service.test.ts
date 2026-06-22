import { describe, it, expect } from '@jest/globals';
import {
  calculateInterest,
  calculateRunningBalances,
  calculateTermDays,
  getAccrualEndDate,
  TransactionRecord,
  RateLog
} from './interest.service';
import dayjs from 'dayjs';

describe('Interest Service', () => {
  it('should calculate daily interest without transactions', () => {
    const startDate = dayjs('2023-01-01').toDate();
    const endDate = dayjs('2023-01-11').toDate(); // 10 days
    const principal = 100000;
    const rate = 2;

    const result = calculateInterest(principal, 'DAILY', startDate, endDate, [], [
      { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
    ]);

    expect(result.daysElapsed).toBe(10);
    expect(result.totalInterestAccrued).toBe(20000);
    expect(result.currentOutstandingPrincipal).toBe(100000);
    expect(result.totalPayable).toBe(120000);
  });

  it('should calculate daily interest with a principal repayment', () => {
    const startDate = dayjs('2023-01-01').toDate();
    const endDate = dayjs('2023-01-11').toDate();
    const principal = 100000;
    const rate = 2;

    const transactions: TransactionRecord[] = [
      {
        date: dayjs('2023-01-06').toDate(),
        type: 'DEBIT',
        amount: 50000
      }
    ];

    const result = calculateInterest(principal, 'DAILY', startDate, endDate, transactions, [
      { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
    ]);

    expect(result.totalInterestAccrued).toBe(15000);
    expect(result.currentOutstandingPrincipal).toBe(50000);
    expect(result.totalPayable).toBe(65000);
  });

  it('should calculate weekly interest with daily proration', () => {
    const startDate = dayjs('2023-01-01').toDate();
    const endDate = dayjs('2023-01-15').toDate(); // 14 days
    const principal = 10000;
    const rate = 1;

    const result = calculateInterest(principal, 'WEEKLY', startDate, endDate, [], [
      { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
    ]);

    expect(result.totalInterestAccrued).toBe(200);
  });

  it('should calculate monthly interest with daily proration', () => {
    const startDate = dayjs('2023-01-01').toDate();
    const endDate = dayjs('2023-03-02').toDate(); // 60 days
    const principal = 50000;
    const rate = 2;

    const result = calculateInterest(principal, 'MONTHLY', startDate, endDate, [], [
      { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
    ]);

    expect(result.totalInterestAccrued).toBe(2000);
  });

  it('should track interest collections correctly', () => {
    const startDate = dayjs('2023-01-01').toDate();
    const endDate = dayjs('2023-01-11').toDate();
    const principal = 100000;
    const rate = 2;

    const transactions: TransactionRecord[] = [
      {
        date: dayjs('2023-01-06').toDate(),
        type: 'INTEREST_COLLECTION',
        amount: 8000
      }
    ];

    const result = calculateInterest(principal, 'DAILY', startDate, endDate, transactions, [
      { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
    ]);

    expect(result.totalInterestAccrued).toBe(20000);
    expect(result.totalInterestCollected).toBe(8000);
    expect(result.currentOutstandingInterest).toBe(12000);
  });

  it('should calculate fixed interest amount', () => {
    const startDate = dayjs('2023-01-01').toDate();
    const endDate = dayjs('2023-01-11').toDate();
    const principal = 100000;

    const result = calculateInterest(principal, 'DAILY', startDate, endDate, [], [
      { interestRate: 500, interestRateType: 'FIXED', effectiveDate: startDate }
    ]);

    expect(result.totalInterestAccrued).toBe(5000);
  });

  it('should calculate partitioned rate changes correctly', () => {
    const startDate = dayjs('2023-01-01').toDate();
    const endDate = dayjs('2023-01-11').toDate();
    const principal = 100000;

    const rates: RateLog[] = [
      { interestRate: 2, interestRateType: 'PERCENTAGE', effectiveDate: startDate },
      { interestRate: 1, interestRateType: 'PERCENTAGE', effectiveDate: dayjs('2023-01-06').toDate() }
    ];

    const result = calculateInterest(principal, 'DAILY', startDate, endDate, [], rates);

    expect(result.totalInterestAccrued).toBe(15000);
  });

  it('should calculate 9 days weekly interest on transaction due date', () => {
    const startDate = dayjs('2026-04-23').toDate();
    const dueDate = dayjs('2026-05-02').toDate();
    const principal = 244094;
    const rate = 2;

    const transactions: TransactionRecord[] = [
      {
        date: dueDate,
        type: 'DEBIT',
        amount: 10000
      }
    ];

    const result = calculateInterest(
      principal,
      'WEEKLY',
      startDate,
      dueDate,
      transactions,
      [{ interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }]
    );

    expect(result.daysElapsed).toBe(9);
    expect(result.totalInterestAccrued).toBeCloseTo(6276.703, 2);
    expect(result.currentOutstandingPrincipal).toBe(234094);
  });

  it('should continue accruing after due date until closed', () => {
    const startDate = dayjs('2026-04-23').toDate();
    const dueDate = dayjs('2026-05-02').toDate();
    const txAfterDue = dayjs('2026-05-09').toDate();
    const principal = 244094;
    const rate = 2;

    const transactions: TransactionRecord[] = [
      {
        date: txAfterDue,
        type: 'DEBIT',
        amount: 10000
      }
    ];

    const resultAtDue = calculateInterest(
      principal,
      'WEEKLY',
      startDate,
      dueDate,
      transactions,
      [{ interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }]
    );

    const resultAfterDue = calculateInterest(
      principal,
      'WEEKLY',
      startDate,
      txAfterDue,
      transactions,
      [{ interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }]
    );

    expect(resultAtDue.daysElapsed).toBe(9);
    expect(resultAfterDue.daysElapsed).toBe(16);
    expect(resultAfterDue.totalInterestAccrued).toBeGreaterThan(resultAtDue.totalInterestAccrued);
    expect(resultAfterDue.totalInterestAccrued).toBeCloseTo(11158.14, 0);
  });

  it('should include CHARGE in total payable', () => {
    const startDate = dayjs('2023-01-01').toDate();
    const endDate = dayjs('2023-01-11').toDate();
    const principal = 100000;

    const transactions: TransactionRecord[] = [
      {
        date: dayjs('2023-01-05').toDate(),
        type: 'CHARGE',
        amount: 500
      }
    ];

    const result = calculateInterest(principal, 'DAILY', startDate, endDate, transactions, [
      { interestRate: 2, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
    ]);

    expect(result.totalCharges).toBe(500);
    expect(result.totalPayable).toBe(result.currentOutstandingPrincipal + result.currentOutstandingInterest + 500);
  });

  it('should compute running balances in single pass', () => {
    const startDate = dayjs('2023-01-01').toDate();
    const principal = 100000;
    const rateLog = { interestRate: 2, interestRateType: 'PERCENTAGE' as const, effectiveDate: startDate };

    const transactions: TransactionRecord[] = [
      { date: dayjs('2023-01-06').toDate(), type: 'DEBIT', amount: 50000 },
      { date: dayjs('2023-01-11').toDate(), type: 'INTEREST_COLLECTION', amount: 5000 }
    ];

    const balances = calculateRunningBalances(principal, 'DAILY', startDate, transactions, [rateLog]);

    expect(balances).toHaveLength(2);
    expect(balances[0].principal).toBe(50000);
    expect(balances[0].interest).toBe(10000);
    expect(balances[1].interest).toBe(10000);
  });

  it('should compute term days separately from accrual days', () => {
    const startDate = dayjs('2026-04-23').toDate();
    const dueDate = dayjs('2026-05-02').toDate();

    expect(calculateTermDays(startDate, dueDate)).toBe(9);
    expect(calculateTermDays(startDate, null)).toBeNull();
  });

  it('should normalize getAccrualEndDate to start of day', () => {
    const end = getAccrualEndDate(new Date('2026-05-09T18:30:00'));
    expect(dayjs(end).format('YYYY-MM-DD')).toBe('2026-05-09');
  });
});
