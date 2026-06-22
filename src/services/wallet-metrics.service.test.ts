import { describe, it, expect } from '@jest/globals';
import dayjs from 'dayjs';
import {
  aggregateTransactionMetrics,
  buildWalletMetrics,
  calculateAvailableBalance,
  calculateImplicitDisbursements,
  getDashboardLoanScope,
  getWalletLoanScope,
  WalletLoanInput
} from './wallet-metrics.service';
import { RateLog } from './interest.service';

const startDate = dayjs('2026-01-01').toDate();
const accrualEnd = dayjs('2026-01-31').toDate();

const baseRateLogs: RateLog[] = [
  {
    interestRate: 2,
    interestRateType: 'PERCENTAGE',
    effectiveDate: startDate
  }
];

const makeLoan = (
  overrides: Partial<WalletLoanInput> & Pick<WalletLoanInput, 'principal'>
): WalletLoanInput => ({
  status: 'ACTIVE',
  interestType: 'DAILY',
  startDate,
  transactions: [],
  rateLogs: baseRateLogs,
  ...overrides
});

describe('wallet-metrics.service', () => {
  describe('aggregateTransactionMetrics', () => {
    it('sums collections and credit disbursements consistently with dashboard rules', () => {
      const metrics = aggregateTransactionMetrics([
        { type: 'CREDIT', amount: 10000 },
        { type: 'INTEREST_COLLECTION', amount: 200 },
        { type: 'DEBIT', amount: 3000 },
        { type: 'CHARGE', amount: 50 }
      ]);

      expect(metrics.interestEarned).toBe(200);
      expect(metrics.totalCollections).toBe(3250);
      expect(metrics.creditDisbursements).toBe(10000);
    });
  });

  describe('calculateImplicitDisbursements', () => {
    it('uses loan principal when active loan has no CREDIT transaction', () => {
      const implicit = calculateImplicitDisbursements([
        makeLoan({ principal: 10000, transactions: [] })
      ]);

      expect(implicit).toBe(10000);
    });

    it('ignores closed loans and loans with explicit CREDIT transactions', () => {
      const implicit = calculateImplicitDisbursements([
        makeLoan({
          principal: 10000,
          transactions: [{ type: 'CREDIT', amount: 10000 }]
        }),
        makeLoan({ principal: 5000, status: 'FORECLOSED', transactions: [] })
      ]);

      expect(implicit).toBe(0);
    });
  });

  describe('calculateAvailableBalance', () => {
    it('computes cash from opening balance, disbursements, and collections', () => {
      expect(calculateAvailableBalance(50000, 10000, 200)).toBe(40200);
      expect(calculateAvailableBalance(50000, 10000, 3200)).toBe(43200);
    });
  });

  describe('buildWalletMetrics', () => {
    it('matches seed-style agent wallet scenario', () => {
      const metrics = buildWalletMetrics(
        50000,
        [
          makeLoan({
            principal: 10000,
            transactions: [
              { type: 'INTEREST_COLLECTION', amount: 200, createdAt: startDate }
            ]
          })
        ],
        accrualEnd
      );

      expect(metrics.totalCollections).toBe(200);
      expect(metrics.interestEarned).toBe(200);
      expect(metrics.totalDisbursements).toBe(10000);
      expect(metrics.balance).toBe(40200);
      expect(metrics.totalAssets).toBe(10000);
    });

    it('reduces outstanding principal after partial DEBIT repayment', () => {
      const metrics = buildWalletMetrics(
        50000,
        [
          makeLoan({
            principal: 10000,
            transactions: [
              { type: 'DEBIT', amount: 3000, createdAt: startDate },
              { type: 'INTEREST_COLLECTION', amount: 200, createdAt: startDate }
            ]
          })
        ],
        accrualEnd
      );

      expect(metrics.balance).toBe(43200);
      expect(metrics.totalAssets).toBe(7000);
      expect(metrics.totalCollections).toBe(3200);
    });

    it('accounts for extra CREDIT top-up transactions', () => {
      const metrics = buildWalletMetrics(
        50000,
        [
          makeLoan({
            principal: 10000,
            transactions: [
              { type: 'CREDIT', amount: 10000, createdAt: startDate },
              { type: 'CREDIT', amount: 5000, createdAt: startDate },
              { type: 'INTEREST_COLLECTION', amount: 200, createdAt: startDate }
            ]
          })
        ],
        accrualEnd
      );

      expect(metrics.creditDisbursements).toBe(15000);
      expect(metrics.totalDisbursements).toBe(15000);
      expect(metrics.balance).toBe(35200);
      expect(metrics.totalAssets).toBe(25000);
    });

    it('excludes foreclosed loans from assets and implicit disbursement', () => {
      const metrics = buildWalletMetrics(
        50000,
        [
          makeLoan({
            principal: 10000,
            status: 'FORECLOSED',
            transactions: [
              { type: 'CREDIT', amount: 10000, createdAt: startDate },
              { type: 'DEBIT', amount: 10000, createdAt: startDate },
              { type: 'INTEREST_COLLECTION', amount: 500, createdAt: startDate }
            ]
          })
        ],
        accrualEnd
      );

      expect(metrics.totalAssets).toBe(0);
      expect(metrics.totalDisbursements).toBe(10000);
      expect(metrics.totalCollections).toBe(10500);
      expect(metrics.balance).toBe(50500);
    });
  });

  describe('scope helpers', () => {
    it('scopes wallet queries to the authenticated user only', () => {
      expect(getWalletLoanScope('agent-1')).toEqual({ createdById: 'agent-1' });
    });

    it('keeps dashboard global for admin and scoped for agents', () => {
      expect(getDashboardLoanScope('ADMIN', 'admin-1')).toEqual({});
      expect(getDashboardLoanScope('AGENT', 'agent-1')).toEqual({
        createdById: 'agent-1'
      });
    });
  });
});
