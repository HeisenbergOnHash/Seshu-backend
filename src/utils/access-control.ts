import { prisma } from './prisma';

export interface AuthenticatedUser {
  userId: string;
  role: string;
}

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const isAdmin = (user: AuthenticatedUser) => user.role === 'ADMIN';

export const ensureAuthenticatedUser = (user?: AuthenticatedUser): AuthenticatedUser => {
  if (!user?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }
  return user;
};

export const ensureBorrowerOwnership = async (user: AuthenticatedUser, borrowerId: string) => {
  const borrower = await prisma.borrower.findUnique({
    where: { id: borrowerId },
    select: { id: true, agentId: true }
  });

  if (!borrower) {
    throw new HttpError(404, 'Borrower not found');
  }

  if (!isAdmin(user) && borrower.agentId !== user.userId) {
    throw new HttpError(403, 'Forbidden');
  }
};

export const ensureLoanOwnership = async (user: AuthenticatedUser, loanId: string) => {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { id: true, createdById: true }
  });

  if (!loan) {
    throw new HttpError(404, 'Loan not found');
  }

  if (!isAdmin(user) && loan.createdById !== user.userId) {
    throw new HttpError(403, 'Forbidden');
  }
};

export const ensureTransactionOwnership = async (user: AuthenticatedUser, transactionId: string) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { id: true, loan: { select: { createdById: true } } }
  });

  if (!transaction) {
    throw new HttpError(404, 'Transaction not found');
  }

  if (!isAdmin(user) && transaction.loan.createdById !== user.userId) {
    throw new HttpError(403, 'Forbidden');
  }
};

export const ensureLoanAccessible = ensureLoanOwnership;

export const handleHttpError = (
  error: unknown,
  fallbackStatusCode = 500
): { statusCode: number; message: string } => {
  if (error instanceof HttpError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  if (error instanceof Error) {
    return { statusCode: fallbackStatusCode, message: error.message };
  }
  return { statusCode: fallbackStatusCode, message: 'Unexpected error' };
};
