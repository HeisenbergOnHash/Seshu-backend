"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = void 0;
const prisma_1 = require("../utils/prisma");
const wallet_metrics_service_1 = require("../services/wallet-metrics.service");
const getDashboardStats = async (req, res) => {
    const role = req.user?.role;
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const loanWhere = (0, wallet_metrics_service_1.getDashboardLoanScope)(role ?? 'AGENT', userId);
    const txWhere = { loan: loanWhere };
    const loans = await prisma_1.prisma.loan.findMany({ where: loanWhere });
    const activeLoans = loans.filter((l) => l.status === 'ACTIVE').length;
    const totalPrincipal = loans.reduce((acc, l) => acc + l.principal, 0);
    const transactions = await prisma_1.prisma.transaction.findMany({ where: txWhere });
    const { totalCollections, interestEarned } = (0, wallet_metrics_service_1.aggregateTransactionMetrics)(transactions);
    res.json({
        totalLoans: loans.length,
        activeLoans,
        totalPrincipal,
        totalCollections,
        interestEarned
    });
};
exports.getDashboardStats = getDashboardStats;
