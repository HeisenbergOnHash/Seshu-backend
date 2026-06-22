import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import {
  calculateInterest,
  calculateRunningBalances,
  calculateTermDays,
  getAccrualEndDate,
  parseCalendarDate,
  TransactionRecord,
  InterestType
} from '../services/interest.service';
import {
  ensureAuthenticatedUser,
  ensureLoanOwnership,
  handleHttpError
} from '../utils/access-control';

export const getLoans = async (req: Request, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.userId;

  const where = role === 'ADMIN' ? {} : { createdById: userId };
  const loans = await prisma.loan.findMany({ 
    where, 
    include: { borrower: true, transactions: true } 
  });
  
  res.json(loans);
};

export const createLoan = async (req: Request, res: Response) => {
  const { borrowerId, principal, interestRate, interestRateType, interestType, startDate, dueDate } = req.body;

  try {
    const user = ensureAuthenticatedUser(req.user);
    const loan = await prisma.loan.create({
      data: {
        principal: parseFloat(principal),
        interestRate: parseFloat(interestRate),
        interestRateType: interestRateType || 'PERCENTAGE',
        interestType,
        startDate: parseCalendarDate(startDate),
        dueDate: dueDate ? parseCalendarDate(dueDate) : null,
        borrowerId,
        createdById: user.userId,
        rateLogs: {
          create: {
            interestRate: parseFloat(interestRate),
            interestRateType: interestRateType || 'PERCENTAGE',
            effectiveDate: parseCalendarDate(startDate)
          }
        }
      }
    });
    res.json(loan);
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err, 400);
    res.status(statusCode).json({ error: message });
  }
};

export const updateLoanDates = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = ensureAuthenticatedUser(req.user);
    const { startDate, dueDate } = req.body;

    await ensureLoanOwnership(user, id);

    const loan = await prisma.loan.update({
      where: { id },
      data: {
        ...(startDate && { startDate: parseCalendarDate(startDate) }),
        ...(dueDate !== undefined && { dueDate: dueDate ? parseCalendarDate(dueDate) : null })
      }
    });
    
    // Also update the first rate log's effective date if we change the start date
    if (startDate) {
      const firstRateLog = await prisma.interestRateLog.findFirst({
        where: { loanId: id },
        orderBy: { effectiveDate: 'asc' }
      });
      if (firstRateLog) {
        await prisma.interestRateLog.update({
          where: { id: firstRateLog.id },
          data: { effectiveDate: parseCalendarDate(startDate) }
        });
      }
    }
    
    res.json(loan);
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err, 400);
    res.status(statusCode).json({ error: message });
  }
};

export const getLoanDetails = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = ensureAuthenticatedUser(req.user);
    await ensureLoanOwnership(user, id);

    const loan = await prisma.loan.findUnique({
      where: { id: id },
      include: { 
        transactions: { orderBy: { createdAt: 'asc' } }, 
        borrower: true,
        rateLogs: { orderBy: { effectiveDate: 'asc' } }
      }
    });
    if (!loan) return res.status(404).json({ error: 'Not found' });

    // Map transactions to the format expected by the interest engine
    const txRecords: TransactionRecord[] = loan.transactions.map(tx => ({
      date: tx.createdAt,
      type: tx.type as 'CREDIT' | 'DEBIT' | 'INTEREST_COLLECTION' | 'CHARGE',
      amount: tx.amount
    }));

    const rateLogs = loan.rateLogs.map(log => ({
      interestRate: log.interestRate,
      interestRateType: log.interestRateType as 'PERCENTAGE' | 'FIXED',
      effectiveDate: log.effectiveDate
    }));

    const asOf = req.query.asOf as string | undefined;
    const endDate = asOf ? getAccrualEndDate(new Date(asOf)) : getAccrualEndDate();
    const termDays = calculateTermDays(loan.startDate, loan.dueDate);

    const interestInfo = calculateInterest(
      loan.principal,
      loan.interestType as InterestType,
      loan.startDate,
      endDate,
      txRecords,
      rateLogs
    );

    const runningBalances = calculateRunningBalances(
      loan.principal,
      loan.interestType as InterestType,
      loan.startDate,
      txRecords,
      rateLogs,
      loan.dueDate
    );

    const transactionsWithBalances = loan.transactions.map((tx, index) => ({
      ...tx,
      balanceAfterTx: {
        principal: runningBalances[index]?.principal ?? loan.principal,
        interest: runningBalances[index]?.interest ?? 0,
        charges: runningBalances[index]?.charges ?? 0,
        interestDays: runningBalances[index]?.interestDays ?? 0
      }
    }));

    res.json({ ...loan, transactions: transactionsWithBalances, interestInfo, termDays });
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err);
    res.status(statusCode).json({ error: message });
  }
};

export const updateLoanRate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = ensureAuthenticatedUser(req.user);
    const { interestRate, interestRateType, effectiveDate } = req.body;

    await ensureLoanOwnership(user, id as string);

    const rateLog = await prisma.interestRateLog.create({
      data: {
        loanId: id as string,
        interestRate: parseFloat(interestRate),
        interestRateType,
        effectiveDate: parseCalendarDate(effectiveDate)
      }
    });

    // Also update the current active rate on the loan model for quick reference
    await prisma.loan.update({
      where: { id: id as string },
      data: {
        interestRate: parseFloat(interestRate),
        interestRateType
      }
    });

    res.json(rateLog);
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err, 400);
    res.status(statusCode).json({ error: message });
  }
};

export const forecloseLoan = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = ensureAuthenticatedUser(req.user);
    const { notes } = req.body;

    await ensureLoanOwnership(user, id);

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { createdAt: 'asc' } },
        rateLogs: { orderBy: { effectiveDate: 'asc' } }
      }
    });

    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (loan.status === 'FORECLOSED' || loan.status === 'CLOSED') {
      return res.status(400).json({ error: 'Loan is already closed' });
    }

    const txRecords: TransactionRecord[] = loan.transactions.map(tx => ({
      date: tx.createdAt,
      type: tx.type as 'CREDIT' | 'DEBIT' | 'INTEREST_COLLECTION' | 'CHARGE',
      amount: tx.amount
    }));

    const rateLogs = loan.rateLogs.map(log => ({
      interestRate: log.interestRate,
      interestRateType: log.interestRateType as 'PERCENTAGE' | 'FIXED',
      effectiveDate: log.effectiveDate
    }));

    const now = new Date();

    const interestInfo = calculateInterest(
      loan.principal,
      loan.interestType as InterestType,
      loan.startDate,
      now,
      txRecords,
      rateLogs
    );

    const { currentOutstandingPrincipal, currentOutstandingInterest, totalPayable } = interestInfo;

    // Perform operations in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Mark loan as FORECLOSED
      await tx.loan.update({
        where: { id },
        data: { status: 'FORECLOSED' }
      });

      // 2. Create Foreclosure record
      await tx.foreclosure.create({
        data: {
          loanId: id,
          amount: totalPayable,
          date: now,
          notes
        }
      });

      // 3. Create balancing transactions to zero out the loan
      if (currentOutstandingInterest > 0) {
        await tx.transaction.create({
          data: {
            loanId: id,
            type: 'INTEREST_COLLECTION',
            amount: currentOutstandingInterest,
            paymentMethod: 'OTHER',
            remarks: 'Auto-generated on foreclosure (Interest settlement)',
            createdAt: now
          }
        });
      }

      if (currentOutstandingPrincipal > 0) {
        await tx.transaction.create({
          data: {
            loanId: id,
            type: 'DEBIT', // Principal repayment
            amount: currentOutstandingPrincipal,
            paymentMethod: 'OTHER',
            remarks: 'Auto-generated on foreclosure (Principal settlement)',
            createdAt: now
          }
        });
      }
    });

    res.json({ message: 'Loan foreclosed successfully', totalPayable });
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err, 400);
    res.status(statusCode).json({ error: message });
  }
};
