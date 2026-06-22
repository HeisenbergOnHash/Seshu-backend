"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallet = void 0;
const prisma_1 = require("../utils/prisma");
const interest_service_1 = require("../services/interest.service");
const getWallet = async (req, res) => {
    const userId = req.user?.userId;
    const role = req.user?.role;
    try {
        const wallet = await prisma_1.prisma.wallet.findUnique({
            where: { userId }
        });
        if (!wallet)
            return res.status(404).json({ error: 'Wallet not found' });
        const loanWhere = role === 'ADMIN' ? {} : { createdById: userId };
        const loans = await prisma_1.prisma.loan.findMany({
            where: loanWhere,
            include: {
                transactions: { orderBy: { createdAt: 'asc' } },
                rateLogs: { orderBy: { effectiveDate: 'asc' } }
            }
        });
        let totalAssets = 0;
        let totalCollections = 0;
        let interestEarned = 0;
        const accrualEnd = (0, interest_service_1.getAccrualEndDate)();
        loans.forEach(loan => {
            if (loan.status === 'ACTIVE' || loan.status === 'DEFAULTED') {
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
                const interestInfo = (0, interest_service_1.calculateInterest)(loan.principal, loan.interestType, loan.startDate, accrualEnd, txRecords, rateLogs);
                totalAssets += interestInfo.currentOutstandingPrincipal;
            }
            loan.transactions.forEach(tx => {
                if (tx.type === 'INTEREST_COLLECTION') {
                    interestEarned += tx.amount;
                    totalCollections += tx.amount;
                }
                else if (tx.type === 'DEBIT' || tx.type === 'CHARGE') {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getWallet = getWallet;
