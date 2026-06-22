import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import {
  aggregateTransactionMetrics,
  getDashboardLoanScope
} from '../services/wallet-metrics.service';

export const getDashboardStats = async (req: Request, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const loanWhere = getDashboardLoanScope(role ?? 'AGENT', userId);
  const txWhere = { loan: loanWhere };

  const loans = await prisma.loan.findMany({ where: loanWhere });
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE').length;
  const totalPrincipal = loans.reduce((acc, l) => acc + l.principal, 0);

  const transactions = await prisma.transaction.findMany({ where: txWhere });
  const { totalCollections, interestEarned } = aggregateTransactionMetrics(transactions);

  res.json({
    totalLoans: loans.length,
    activeLoans,
    totalPrincipal,
    totalCollections,
    interestEarned
  });
};
