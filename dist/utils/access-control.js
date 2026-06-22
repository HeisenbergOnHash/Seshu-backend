"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHttpError = exports.ensureLoanAccessible = exports.ensureTransactionOwnership = exports.ensureLoanOwnership = exports.ensureBorrowerOwnership = exports.ensureAuthenticatedUser = exports.HttpError = void 0;
const prisma_1 = require("./prisma");
class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.HttpError = HttpError;
const isAdmin = (user) => user.role === 'ADMIN';
const ensureAuthenticatedUser = (user) => {
    if (!user?.userId) {
        throw new HttpError(401, 'Unauthorized');
    }
    return user;
};
exports.ensureAuthenticatedUser = ensureAuthenticatedUser;
const ensureBorrowerOwnership = async (user, borrowerId) => {
    const borrower = await prisma_1.prisma.borrower.findUnique({
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
exports.ensureBorrowerOwnership = ensureBorrowerOwnership;
const ensureLoanOwnership = async (user, loanId) => {
    const loan = await prisma_1.prisma.loan.findUnique({
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
exports.ensureLoanOwnership = ensureLoanOwnership;
const ensureTransactionOwnership = async (user, transactionId) => {
    const transaction = await prisma_1.prisma.transaction.findUnique({
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
exports.ensureTransactionOwnership = ensureTransactionOwnership;
exports.ensureLoanAccessible = exports.ensureLoanOwnership;
const handleHttpError = (error, fallbackStatusCode = 500) => {
    if (error instanceof HttpError) {
        return { statusCode: error.statusCode, message: error.message };
    }
    if (error instanceof Error) {
        return { statusCode: fallbackStatusCode, message: error.message };
    }
    return { statusCode: fallbackStatusCode, message: 'Unexpected error' };
};
exports.handleHttpError = handleHttpError;
