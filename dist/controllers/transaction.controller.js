"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTransaction = exports.createTransaction = exports.getTransactions = void 0;
const prisma_1 = require("../utils/prisma");
const access_control_1 = require("../utils/access-control");
const getTransactions = async (req, res) => {
    const role = req.user?.role;
    const userId = req.user?.userId;
    const { startDate, endDate } = req.query;
    const baseWhere = role === 'ADMIN' ? {} : { loan: { createdById: userId } };
    const dateFilter = {};
    if (startDate) {
        dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
        dateFilter.lte = new Date(endDate);
    }
    const where = Object.keys(dateFilter).length > 0
        ? { ...baseWhere, createdAt: dateFilter }
        : baseWhere;
    const transactions = await prisma_1.prisma.transaction.findMany({
        where,
        include: { loan: { include: { borrower: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.json(transactions);
};
exports.getTransactions = getTransactions;
const createTransaction = async (req, res) => {
    const { loanId, type, amount, paymentMethod, referenceNumber, remarks, date } = req.body;
    try {
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        await (0, access_control_1.ensureLoanAccessible)(user, loanId);
        const transaction = await prisma_1.prisma.transaction.create({
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
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err, 400);
        res.status(statusCode).json({ error: message });
    }
};
exports.createTransaction = createTransaction;
const updateTransaction = async (req, res) => {
    try {
        const id = req.params.id;
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        const { type, date, amount } = req.body;
        await (0, access_control_1.ensureTransactionOwnership)(user, id);
        const transaction = await prisma_1.prisma.transaction.update({
            where: { id },
            data: {
                ...(type && { type }),
                ...(date && { createdAt: new Date(date) }),
                ...(amount !== undefined && { amount: parseFloat(amount) })
            }
        });
        res.json(transaction);
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err, 400);
        res.status(statusCode).json({ error: message });
    }
};
exports.updateTransaction = updateTransaction;
