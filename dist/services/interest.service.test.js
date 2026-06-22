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
        const rate = 2;
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
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate();
        const principal = 100000;
        const rate = 2;
        const transactions = [
            {
                date: (0, dayjs_1.default)('2023-01-06').toDate(),
                type: 'DEBIT',
                amount: 50000
            }
        ];
        const result = (0, interest_service_1.calculateInterest)(principal, 'DAILY', startDate, endDate, transactions, [
            { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
        ]);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(15000);
        (0, globals_1.expect)(result.currentOutstandingPrincipal).toBe(50000);
        (0, globals_1.expect)(result.totalPayable).toBe(65000);
    });
    (0, globals_1.it)('should calculate weekly interest with daily proration', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-15').toDate(); // 14 days
        const principal = 10000;
        const rate = 1;
        const result = (0, interest_service_1.calculateInterest)(principal, 'WEEKLY', startDate, endDate, [], [
            { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
        ]);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(200);
    });
    (0, globals_1.it)('should calculate monthly interest with daily proration', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-03-02').toDate(); // 60 days
        const principal = 50000;
        const rate = 2;
        const result = (0, interest_service_1.calculateInterest)(principal, 'MONTHLY', startDate, endDate, [], [
            { interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
        ]);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(2000);
    });
    (0, globals_1.it)('should track interest collections correctly', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate();
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
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(20000);
        (0, globals_1.expect)(result.totalInterestCollected).toBe(8000);
        (0, globals_1.expect)(result.currentOutstandingInterest).toBe(12000);
    });
    (0, globals_1.it)('should calculate fixed interest amount', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate();
        const principal = 100000;
        const result = (0, interest_service_1.calculateInterest)(principal, 'DAILY', startDate, endDate, [], [
            { interestRate: 500, interestRateType: 'FIXED', effectiveDate: startDate }
        ]);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(5000);
    });
    (0, globals_1.it)('should calculate partitioned rate changes correctly', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate();
        const principal = 100000;
        const rates = [
            { interestRate: 2, interestRateType: 'PERCENTAGE', effectiveDate: startDate },
            { interestRate: 1, interestRateType: 'PERCENTAGE', effectiveDate: (0, dayjs_1.default)('2023-01-06').toDate() }
        ];
        const result = (0, interest_service_1.calculateInterest)(principal, 'DAILY', startDate, endDate, [], rates);
        (0, globals_1.expect)(result.totalInterestAccrued).toBe(15000);
    });
    (0, globals_1.it)('should calculate 9 days weekly interest on transaction due date', () => {
        const startDate = (0, dayjs_1.default)('2026-04-23').toDate();
        const dueDate = (0, dayjs_1.default)('2026-05-02').toDate();
        const principal = 244094;
        const rate = 2;
        const transactions = [
            {
                date: dueDate,
                type: 'DEBIT',
                amount: 10000
            }
        ];
        const result = (0, interest_service_1.calculateInterest)(principal, 'WEEKLY', startDate, dueDate, transactions, [{ interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }]);
        (0, globals_1.expect)(result.daysElapsed).toBe(9);
        (0, globals_1.expect)(result.totalInterestAccrued).toBeCloseTo(6276.703, 2);
        (0, globals_1.expect)(result.currentOutstandingPrincipal).toBe(234094);
    });
    (0, globals_1.it)('should continue accruing after due date until closed', () => {
        const startDate = (0, dayjs_1.default)('2026-04-23').toDate();
        const dueDate = (0, dayjs_1.default)('2026-05-02').toDate();
        const txAfterDue = (0, dayjs_1.default)('2026-05-09').toDate();
        const principal = 244094;
        const rate = 2;
        const transactions = [
            {
                date: txAfterDue,
                type: 'DEBIT',
                amount: 10000
            }
        ];
        const resultAtDue = (0, interest_service_1.calculateInterest)(principal, 'WEEKLY', startDate, dueDate, transactions, [{ interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }]);
        const resultAfterDue = (0, interest_service_1.calculateInterest)(principal, 'WEEKLY', startDate, txAfterDue, transactions, [{ interestRate: rate, interestRateType: 'PERCENTAGE', effectiveDate: startDate }]);
        (0, globals_1.expect)(resultAtDue.daysElapsed).toBe(9);
        (0, globals_1.expect)(resultAfterDue.daysElapsed).toBe(16);
        (0, globals_1.expect)(resultAfterDue.totalInterestAccrued).toBeGreaterThan(resultAtDue.totalInterestAccrued);
        (0, globals_1.expect)(resultAfterDue.totalInterestAccrued).toBeCloseTo(11158.14, 0);
    });
    (0, globals_1.it)('should include CHARGE in total payable', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const endDate = (0, dayjs_1.default)('2023-01-11').toDate();
        const principal = 100000;
        const transactions = [
            {
                date: (0, dayjs_1.default)('2023-01-05').toDate(),
                type: 'CHARGE',
                amount: 500
            }
        ];
        const result = (0, interest_service_1.calculateInterest)(principal, 'DAILY', startDate, endDate, transactions, [
            { interestRate: 2, interestRateType: 'PERCENTAGE', effectiveDate: startDate }
        ]);
        (0, globals_1.expect)(result.totalCharges).toBe(500);
        (0, globals_1.expect)(result.totalPayable).toBe(result.currentOutstandingPrincipal + result.currentOutstandingInterest + 500);
    });
    (0, globals_1.it)('should compute running balances in single pass', () => {
        const startDate = (0, dayjs_1.default)('2023-01-01').toDate();
        const principal = 100000;
        const rateLog = { interestRate: 2, interestRateType: 'PERCENTAGE', effectiveDate: startDate };
        const transactions = [
            { date: (0, dayjs_1.default)('2023-01-06').toDate(), type: 'DEBIT', amount: 50000 },
            { date: (0, dayjs_1.default)('2023-01-11').toDate(), type: 'INTEREST_COLLECTION', amount: 5000 }
        ];
        const balances = (0, interest_service_1.calculateRunningBalances)(principal, 'DAILY', startDate, transactions, [rateLog]);
        (0, globals_1.expect)(balances).toHaveLength(2);
        (0, globals_1.expect)(balances[0].principal).toBe(50000);
        (0, globals_1.expect)(balances[0].interest).toBe(10000);
        (0, globals_1.expect)(balances[1].interest).toBe(10000);
    });
    (0, globals_1.it)('should compute term days separately from accrual days', () => {
        const startDate = (0, dayjs_1.default)('2026-04-23').toDate();
        const dueDate = (0, dayjs_1.default)('2026-05-02').toDate();
        (0, globals_1.expect)((0, interest_service_1.calculateTermDays)(startDate, dueDate)).toBe(9);
        (0, globals_1.expect)((0, interest_service_1.calculateTermDays)(startDate, null)).toBeNull();
    });
    (0, globals_1.it)('should normalize getAccrualEndDate to start of day', () => {
        const end = (0, interest_service_1.getAccrualEndDate)(new Date('2026-05-09T18:30:00'));
        (0, globals_1.expect)((0, dayjs_1.default)(end).format('YYYY-MM-DD')).toBe('2026-05-09');
    });
});
