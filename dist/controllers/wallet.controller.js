"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallet = void 0;
const prisma_1 = require("../utils/prisma");
const wallet_metrics_service_1 = require("../services/wallet-metrics.service");
const getWallet = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const wallet = await prisma_1.prisma.wallet.findUnique({
            where: { userId }
        });
        if (!wallet)
            return res.status(404).json({ error: 'Wallet not found' });
        const loans = await prisma_1.prisma.loan.findMany({
            where: (0, wallet_metrics_service_1.getWalletLoanScope)(userId),
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
                interestRateType: log.interestRateType,
                effectiveDate: log.effectiveDate
            }))
        }));
        const metrics = (0, wallet_metrics_service_1.buildWalletMetrics)(wallet.balance, loanInputs);
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        res.status(500).json({ error: message });
    }
};
exports.getWallet = getWallet;
