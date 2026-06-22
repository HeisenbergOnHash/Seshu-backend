import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import {
  ensureAuthenticatedUser,
  ensureLoanAccessible,
  ensureTransactionOwnership,
  handleHttpError
} from '../utils/access-control';

export const getTransactions = async (req: Request, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.userId;
  const { startDate, endDate } = req.query;

  const baseWhere = role === 'ADMIN' ? {} : { loan: { createdById: userId } };
  
  const dateFilter: any = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate as string);
  }
  if (endDate) {
    dateFilter.lte = new Date(endDate as string);
  }

  const where = Object.keys(dateFilter).length > 0 
    ? { ...baseWhere, createdAt: dateFilter }
    : baseWhere;

  const transactions = await prisma.transaction.findMany({
    where,
    include: { loan: { include: { borrower: true } } },
    orderBy: { createdAt: 'desc' }
  });
  
  res.json(transactions);
};

export const createTransaction = async (req: Request, res: Response) => {
  const { loanId, type, amount, paymentMethod, referenceNumber, remarks, date } = req.body;

  try {
    const user = ensureAuthenticatedUser(req.user);
    await ensureLoanAccessible(user, loanId);

    const transaction = await prisma.transaction.create({
      data: {
        loanId, 
        type, 
        amount: parseFloat(amount), 
        paymentMethod, 
        referenceNumber, 
        remarks,
        createdAt: date ? new Date(date) : new Date()
      }
    });
    res.json(transaction);
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err, 400);
    res.status(statusCode).json({ error: message });
  }
};

export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = ensureAuthenticatedUser(req.user);
    const { type, date, amount } = req.body;
    await ensureTransactionOwnership(user, id);

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(date && { createdAt: new Date(date) }),
        ...(amount !== undefined && { amount: parseFloat(amount) })
      }
    });
    res.json(transaction);
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err, 400);
    res.status(statusCode).json({ error: message });
  }
};
