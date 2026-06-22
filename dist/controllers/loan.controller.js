"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forecloseLoan = exports.updateLoanRate = exports.getLoanDetails = exports.updateLoanDates = exports.createLoan = exports.getLoans = void 0;
const prisma_1 = require("../utils/prisma");
const interest_service_1 = require("../services/interest.service");
const access_control_1 = require("../utils/access-control");
const getLoans = async (req, res) => {
    const role = req.user?.role;
    const userId = req.user?.userId;
    const where = role === 'ADMIN' ? {} : { createdById: userId };
    const loans = await prisma_1.prisma.loan.findMany({
        where,
        include: { borrower: true, transactions: true }
    });
    res.json(loans);
};
exports.getLoans = getLoans;
const createLoan = async (req, res) => {
    const { borrowerId, principal, interestRate, interestRateType, interestType, startDate, dueDate } = req.body;
    try {
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        const loan = await prisma_1.prisma.loan.create({
            data: {
                principal: parseFloat(principal),
                interestRate: parseFloat(interestRate),
                interestRateType: interestRateType || 'PERCENTAGE',
                interestType,
                startDate: (0, interest_service_1.parseCalendarDate)(startDate),
                dueDate: dueDate ? (0, interest_service_1.parseCalendarDate)(dueDate) : null,
                borrowerId,
                createdById: user.userId,
                rateLogs: {
                    create: {
                        interestRate: parseFloat(interestRate),
                        interestRateType: interestRateType || 'PERCENTAGE',
                        effectiveDate: (0, interest_service_1.parseCalendarDate)(startDate)
                    }
                }
            }
        });
        res.json(loan);
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err, 400);
        res.status(statusCode).json({ error: message });
    }
};
exports.createLoan = createLoan;
const updateLoanDates = async (req, res) => {
    try {
        const id = req.params.id;
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        const { startDate, dueDate } = req.body;
        await (0, access_control_1.ensureLoanOwnership)(user, id);
        const loan = await prisma_1.prisma.loan.update({
            where: { id },
            data: {
                ...(startDate && { startDate: (0, interest_service_1.parseCalendarDate)(startDate) }),
                ...(dueDate !== undefined && { dueDate: dueDate ? (0, interest_service_1.parseCalendarDate)(dueDate) : null })
            }
        });
        // Also update the first rate log's effective date if we change the start date
        if (startDate) {
            const firstRateLog = await prisma_1.prisma.interestRateLog.findFirst({
                where: { loanId: id },
                orderBy: { effectiveDate: 'asc' }
            });
            if (firstRateLog) {
                await prisma_1.prisma.interestRateLog.update({
                    where: { id: firstRateLog.id },
                    data: { effectiveDate: (0, interest_service_1.parseCalendarDate)(startDate) }
                });
            }
        }
        res.json(loan);
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err, 400);
        res.status(statusCode).json({ error: message });
    }
};
exports.updateLoanDates = updateLoanDates;
const getLoanDetails = async (req, res) => {
    try {
        const id = req.params.id;
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        await (0, access_control_1.ensureLoanOwnership)(user, id);
        const loan = await prisma_1.prisma.loan.findUnique({
            where: { id: id },
            include: {
                transactions: { orderBy: { createdAt: 'asc' } },
                borrower: true,
                rateLogs: { orderBy: { effectiveDate: 'asc' } }
            }
        });
        if (!loan)
            return res.status(404).json({ error: 'Not found' });
        // Map transactions to the format expected by the interest engine
        const txRecords = loan.transactions.map(tx => ({
            date: tx.createdAt,
            type: tx.type,
            amount: tx.amount
        }));
        const rateLogs = loan.rateLogs.map(log => ({
            interestRate: log.interestRate,
            interestRateType: log.interestRateType,
            effectiveDate: log.effectiveDate
        }));
        const asOf = req.query.asOf;
        const endDate = asOf ? (0, interest_service_1.getAccrualEndDate)(new Date(asOf)) : (0, interest_service_1.getAccrualEndDate)();
        const termDays = (0, interest_service_1.calculateTermDays)(loan.startDate, loan.dueDate);
        const interestInfo = (0, interest_service_1.calculateInterest)(loan.principal, loan.interestType, loan.startDate, endDate, txRecords, rateLogs);
        const runningBalances = (0, interest_service_1.calculateRunningBalances)(loan.principal, loan.interestType, loan.startDate, txRecords, rateLogs, loan.dueDate);
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
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err);
        res.status(statusCode).json({ error: message });
    }
};
exports.getLoanDetails = getLoanDetails;
const updateLoanRate = async (req, res) => {
    try {
        const { id } = req.params;
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        const { interestRate, interestRateType, effectiveDate } = req.body;
        await (0, access_control_1.ensureLoanOwnership)(user, id);
        const rateLog = await prisma_1.prisma.interestRateLog.create({
            data: {
                loanId: id,
                interestRate: parseFloat(interestRate),
                interestRateType,
                effectiveDate: (0, interest_service_1.parseCalendarDate)(effectiveDate)
            }
        });
        // Also update the current active rate on the loan model for quick reference
        await prisma_1.prisma.loan.update({
            where: { id: id },
            data: {
                interestRate: parseFloat(interestRate),
                interestRateType
            }
        });
        res.json(rateLog);
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err, 400);
        res.status(statusCode).json({ error: message });
    }
};
exports.updateLoanRate = updateLoanRate;
const forecloseLoan = async (req, res) => {
    try {
        const id = req.params.id;
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        const { notes } = req.body;
        await (0, access_control_1.ensureLoanOwnership)(user, id);
        const loan = await prisma_1.prisma.loan.findUnique({
            where: { id },
            include: {
                transactions: { orderBy: { createdAt: 'asc' } },
                rateLogs: { orderBy: { effectiveDate: 'asc' } }
            }
        });
        if (!loan)
            return res.status(404).json({ error: 'Loan not found' });
        if (loan.status === 'FORECLOSED' || loan.status === 'CLOSED') {
            return res.status(400).json({ error: 'Loan is already closed' });
        }
        const txRecords = loan.transactions.map(tx => ({
            date: tx.createdAt,
            type: tx.type,
            amount: tx.amount
        }));
        const rateLogs = loan.rateLogs.map(log => ({
            interestRate: log.interestRate,
            interestRateType: log.interestRateType,
            effectiveDate: log.effectiveDate
        }));
        const now = new Date();
        const interestInfo = (0, interest_service_1.calculateInterest)(loan.principal, loan.interestType, loan.startDate, now, txRecords, rateLogs);
        const { currentOutstandingPrincipal, currentOutstandingInterest, totalPayable } = interestInfo;
        // Perform operations in a transaction
        await prisma_1.prisma.$transaction(async (tx) => {
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
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err, 400);
        res.status(statusCode).json({ error: message });
    }
};
exports.forecloseLoan = forecloseLoan;
