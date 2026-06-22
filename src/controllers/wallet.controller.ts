import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { RateLog } from '../services/interest.service';
import {
  buildWalletMetrics,
  getWalletLoanScope
} from '../services/wallet-metrics.service';

export const getWallet = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const loans = await prisma.loan.findMany({
      where: getWalletLoanScope(userId),
      include: {
        transactions: { orderBy: { createdAt: 'asc' } },
        rateLogs: { orderBy: { effectiveDate: 'asc' } }
      }
    });

    const loanInputs = loans.map((loan) => ({
      status: loan.status,
      principal: loan.principal,
      interestType: loan.interestType,
      startDate: loan.startDate,
      transactions: loan.transactions.map((tx) => ({
        type: tx.type,
        amount: tx.amount,
        createdAt: tx.createdAt
      })),
      rateLogs: loan.rateLogs.map((log) => ({
        interestRate: log.interestRate,
        interestRateType: log.interestRateType as RateLog['interestRateType'],
        effectiveDate: log.effectiveDate
      }))
    }));

    const metrics = buildWalletMetrics(wallet.balance, loanInputs);

    res.json({
      id: wallet.id,
      userId: wallet.userId,
      openingBalance: wallet.balance,
      balance: metrics.balance,
      totalAssets: metrics.totalAssets,
      totalCollections: metrics.totalCollections,
      interestEarned: metrics.interestEarned,
      totalLiabilities: 0,
      updatedAt: wallet.updatedAt
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ error: message });
  }
};
