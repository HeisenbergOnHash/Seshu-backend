import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getDashboardStats = async (req: Request, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.userId;

  const loanWhere = role === 'ADMIN' ? {} : { createdById: userId };
  const txWhere = role === 'ADMIN' ? {} : { loan: { createdById: userId } };

  const loans = await prisma.loan.findMany({ where: loanWhere });
  const activeLoans = loans.filter(l => l.status === 'ACTIVE').length;
  const totalPrincipal = loans.reduce((acc, l) => acc + l.principal, 0);

  const transactions = await prisma.transaction.findMany({ where: txWhere });
  const totalCollections = transactions.filter(t => t.type !== 'CREDIT').reduce((acc, t) => acc + t.amount, 0);
  const interestEarned = transactions.filter(t => t.type === 'INTEREST_COLLECTION').reduce((acc, t) => acc + t.amount, 0);

  res.json({
    totalLoans: loans.length,
    activeLoans,
    totalPrincipal,
    totalCollections,
    interestEarned
  });
};
