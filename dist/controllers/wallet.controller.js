"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallet = void 0;
const prisma_1 = require("../utils/prisma");
const getWallet = async (req, res) => {
    const userId = req.user?.userId;
    const role = req.user?.role;
    try {
        // We fetch the wallet just for the initial baseline balance
        const wallet = await prisma_1.prisma.wallet.findUnique({
            where: { userId }
        });
        if (!wallet)
            return res.status(404).json({ error: 'Wallet not found' });
        // Fetch all loans created by this user (or all if admin)
        const loanWhere = role === 'ADMIN' ? {} : { createdById: userId };
        const loans = await prisma_1.prisma.loan.findMany({
            where: loanWhere,
            include: { transactions: true }
        });
        // Compute dynamic assets (money lent out)
        let totalAssets = 0;
        // Compute dynamic collections
        let totalCollections = 0;
        let interestEarned = 0;
        loans.forEach(loan => {
            // If loan is active or defaulted, the principal is an asset (lent money)
            if (loan.status === 'ACTIVE' || loan.status === 'DEFAULTED') {
                // Technically, true asset value is (initial principal - principal repaid)
                // But in simple accounting, Assets = Current Outstanding Principal
                let principalRepaid = 0;
                loan.transactions.forEach(tx => {
                    if (tx.type === 'DEBIT') {
                        principalRepaid += tx.amount;
                    }
                });
                const outstandingPrincipal = loan.principal - principalRepaid;
                totalAssets += (outstandingPrincipal > 0 ? outstandingPrincipal : 0);
            }
            // Tally transactions
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
        // The available cash dynamically shifts based on how much was lent out 
        // vs how much was recovered. (Initial balance - Original Principals + Collections)
        let totalPrincipalDisbursed = 0;
        loans.forEach(loan => {
            totalPrincipalDisbursed += loan.principal;
        });
        // Re-calculate the available cash based on real transactions and loans
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
