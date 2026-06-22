"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const interest_service_1 = require("./interest.service");
const dayjs_1 = __importDefault(require("dayjs"));
(0, globals_1.describe)('Interest Service', () => {
    (0, globals_1.it)('should calculate daily interest without transactions', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate(); // 10 days
        const principal = 100000;
        const rate = 2; // 2% per day -> 2000 per day
        const result = (0, interest_service_1.calculateInterest)(principal, 'DAILY', startDate, endDate, [], [
            { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
        ]);
        (0, globals_1.expect)(result.daysElapsed).toBe(10);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(20000);
        (0, globals_1.expect)(result.currentOutstandingPrincipal).toBe(100000);
        (0, globals_1.expect)(result.totalPayable).toBe(120000);
    });
    (0, globals_1.it)('should calculate daily interest with a principal repayment', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate(); // 10 days
        const principal = 100000;
        const rate = 2;
        const transactions = [
            {
                date: (0, dayjs_1.default)('2023-01-06').toDate(), // 5 days at 100000 = 10000 interest
                type: 'DEBIT',
                amount: 50000 // repay 50000 principal
            }
        ];
        const result = (0, interest_service_1.calculateInterest)(principal, 'DAILY', startDate, endDate, transactions, [
            { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
        ]);
        // Day 1-6: 5 days * 2% * 100k = 10,000
        // Day 6-11: 5 days * 2% * 50k = 5,000
        // Total interest = 15,000
        // Outstanding Principal = 50,000
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(15000);
        (0, globals_1.expect)(result.currentOutstandingPrincipal).toBe(50000);
        (0, globals_1.expect)(result.totalPayable).toBe(65000);
    });
    (0, globals_1.it)('should calculate weekly interest', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-15').toDate(); // 14 days = 2 weeks
        const principal = 10000;
        const rate = 1; // 1% per week = 100 per week
        const result = (0, interest_service_1.calculateInterest)(principal, 'WEEKLY', startDate, endDate, [], [
            { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
        ]);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(200);
    });
    (0, globals_1.it)('should calculate monthly interest', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-03-02').toDate(); // 60 days = 2 months
        const principal = 50000;
        const rate = 2; // 2% per month = 1000 per month
        const result = (0, interest_service_1.calculateInterest)(principal, 'MONTHLY', startDate, endDate, [], [
            { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
        ]);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(2000);
    });
    (0, globals_1.it)('should track interest collections correctly', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate(); // 10 days
        const principal = 100000;
        const rate = 2;
        const transactions = [
            {
                date: (0, dayjs_1.default)('2023-01-06').toDate(),
                type: 'INTEREST_COLLECTION',
                amount: 8000
            }
        ];
        const result = (0, interest_service_1.calculateInterest)(principal, 'DAILY', startDate, endDate, transactions, [
            { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
        ]);
        // 10 days total = 20,000 accrued
        // 8,000 collected
        // outstanding = 12,000
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(20000);
        (0, globals_1.expect)(result.totalInterestCollected).toBe(8000);
        (0, globals_1.expect)(result.currentOutstandingInterest).toBe(12000);
    });
    (0, globals_1.it)('should calculate fixed interest amount', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate(); // 10 days
        const principal = 100000;
        // Fixed amount of 500 per day
        const result = (0, interest_service_1.calculateInterest)(principal, 'DAILY', startDate, endDate, [], [
            { interestRate: 500, interestRateType: 'FIXED', effectiveDate: startDate }
        ]);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(5000); // 10 days * 500
    });
    (0, globals_1.it)('should calculate partitioned rate changes correctly', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate(); // 10 days
        const principal = 100000;
        // Day 1-5: 2% per day (2000 per day) -> 10000
        // Day 6-10: 1% per day (1000 per day) -> 5000
        // Total should be 15000
        const rates = [
            { interestRate: 2, interestRateType: 'PERCENTAGE', effectiveDate: startDate },
            { interestRate: 1, interestRateType: 'PERCENTAGE', effectiveDate: (0, dayjs_1.default)('2023-01-06').toDate() }
        ];
        const result = (0, interest_service_1.calculateInterest)(principal, 'DAILY', startDate, endDate, [], rates);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(15000);
    });
});
