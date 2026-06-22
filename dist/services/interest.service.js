"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateInterest = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const calculateInterest = (principal, type, startDate, endDate, transactions, rateLogs) => {
    // Sort transactions by date
    const sortedTx = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    // Sort rate logs by effective date
    const sortedRates = [...rateLogs].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
    let currentPrincipal = principal;
    let totalInterestAccrued = 0;
    let totalInterestCollected = 0;
    let lastDate = (0, dayjs_1.default)(startDate).startOf('day');
    const finalDate = (0, dayjs_1.default)(endDate).startOf('day');
    // Helper to get active rate config for a given date
    const getActiveRate = (date) => {
        // Find the latest rate log whose effective date is <= the given date
        // Fallback to the first rate log if none are strictly before
        let activeLog = sortedRates[0];
        for (const log of sortedRates) {
            if ((0, dayjs_1.default)(log.effectiveDate).startOf('day').isAfter(date.startOf('day'))) {
                break;
            }
            activeLog = log;
        }
        return activeLog;
    };
    // Helper to calculate daily interest amount for a specific principal, rate config, and duration
    const calcPeriodInterest = (principalAmt, daysDiff, date) => {
        const rateLog = getActiveRate(date);
        const { interestRate, interestRateType } = rateLog;
        let dailyAmount = 0;
        if (interestRateType === 'PERCENTAGE') {
            let dailyRateDecimal = 0;
            if (type === 'DAILY') {
                dailyRateDecimal = interestRate / 100;
            }
            else if (type === 'WEEKLY') {
                dailyRateDecimal = (interestRate / 100) / 7;
            }
            else if (type === 'MONTHLY') {
                dailyRateDecimal = (interestRate / 100) / 30;
            }
            dailyAmount = principalAmt * dailyRateDecimal;
        }
        else if (interestRateType === 'FIXED') {
            if (type === 'DAILY') {
                dailyAmount = interestRate;
            }
            else if (type === 'WEEKLY') {
                dailyAmount = interestRate / 7;
            }
            else if (type === 'MONTHLY') {
                dailyAmount = interestRate / 30;
            }
        }
        return dailyAmount * daysDiff;
    };
    // Iterate over transactions to calculate interest between events
    for (const tx of sortedTx) {
        const txDate = (0, dayjs_1.default)(tx.date).startOf('day');
        if (txDate.isAfter(finalDate)) {
            break; // Ignore transactions after the calculation end date
        }
        if (txDate.isBefore(startDate)) {
            continue; // Normally shouldn't happen if transactions start after loan
        }
        const daysDiff = txDate.diff(lastDate, 'day');
        if (daysDiff > 0) {
            // Rather than calculating the entire chunk at once, we technically should check if a rate change happened IN BETWEEN lastDate and txDate.
            // For precision, we step day by day between lastDate and txDate to accrue correctly based on exact active rates.
            for (let i = 0; i < daysDiff; i++) {
                const currentDate = lastDate.add(i, 'day');
                totalInterestAccrued += calcPeriodInterest(currentPrincipal, 1, currentDate);
            }
            lastDate = txDate;
        }
        // Apply transaction
        if (tx.type === 'DEBIT') {
            currentPrincipal -= tx.amount;
            if (currentPrincipal < 0)
                currentPrincipal = 0;
        }
        else if (tx.type === 'CREDIT') {
            currentPrincipal += tx.amount;
        }
        else if (tx.type === 'INTEREST_COLLECTION') {
            totalInterestCollected += tx.amount;
        }
    }
    // Accrue interest from last transaction to end date
    const daysDiffFinal = finalDate.diff(lastDate, 'day');
    if (daysDiffFinal > 0) {
        for (let i = 0; i < daysDiffFinal; i++) {
            const currentDate = lastDate.add(i, 'day');
            totalInterestAccrued += calcPeriodInterest(currentPrincipal, 1, currentDate);
        }
    }
    const currentOutstandingInterest = totalInterestAccrued - totalInterestCollected;
    return {
        totalPrincipal: principal,
        totalInterestAccrued: Math.round(totalInterestAccrued),
        totalInterestCollected,
        currentOutstandingPrincipal: currentPrincipal,
        currentOutstandingInterest: Math.round(currentOutstandingInterest),
        totalPayable: Math.round(currentPrincipal + currentOutstandingInterest),
        daysElapsed: (0, dayjs_1.default)(endDate).diff((0, dayjs_1.default)(startDate).startOf('day'), 'day')
    };
};
exports.calculateInterest = calculateInterest;
