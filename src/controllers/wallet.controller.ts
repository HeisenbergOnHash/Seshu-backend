import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import {
  calculateInterest,
  getAccrualEndDate,
  TransactionRecord,
  InterestType
} from '../services/interest.service';

export const getWallet = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const role = req.user?.role;

  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const loanWhere = role === 'ADMIN' ? {} : { createdById: userId };
    const loans = await prisma.loan.findMany({
      where: loanWhere,
      include: {
        transactions: { orderBy: { createdAt: 'asc' } },
        rateLogs: { orderBy: { effectiveDate: 'asc' } }
      }
    });

    let totalAssets = 0;
    let totalCollections = 0;
    let interestEarned = 0;
    const accrualEnd = getAccrualEndDate();

    loans.forEach(loan => {
      if (loan.status === 'ACTIVE' || loan.status === 'DEFAULTED') {
        const txRecords: TransactionRecord[] = loan.transactions.map(tx => ({
          date: tx.createdAt,
          type: tx.type as TransactionRecord['type'],
          amount: tx.amount
        }));

        const rateLogs = loan.rateLogs.map(log => ({
          interestRate: log.interestRate,
          interestRateType: log.interestRateType as 'PERCENTAGE' | 'FIXED',
          effectiveDate: log.effectiveDate
        }));

        const interestInfo = calculateInterest(
          loan.principal,
          loan.interestType as InterestType,
          loan.startDate,
          accrualEnd,
          txRecords,
          rateLogs
        );

        totalAssets += interestInfo.currentOutstandingPrincipal;
      }

      loan.transactions.forEach(tx => {
        if (tx.type === 'INTEREST_COLLECTION') {
          interestEarned += tx.amount;
          totalCollections += tx.amount;
        } else if (tx.type === 'DEBIT' || tx.type === 'CHARGE') {
          totalCollections += tx.amount;
        }
      });
    });

    let totalPrincipalDisbursed = 0;
    loans.forEach(loan => {
      totalPrincipalDisbursed += loan.principal;
    });

    const dynamicBalance = wallet.balance - totalPrincipalDisbursed + totalCollections;

    res.json({
      ...wallet,
      balance: dynamicBalance,
      totalAssets,
      totalCollections,
      interestEarned
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
