"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const borrower_controller_1 = require("../controllers/borrower.controller");
const loan_controller_1 = require("../controllers/loan.controller");
const transaction_controller_1 = require("../controllers/transaction.controller");
const wallet_controller_1 = require("../controllers/wallet.controller");
const report_controller_1 = require("../controllers/report.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Borrowers
router.get('/borrowers', borrower_controller_1.getBorrowers);
router.post('/borrowers', borrower_controller_1.createBorrower);
router.get('/borrowers/:id', borrower_controller_1.getBorrowerDetails);
router.post('/borrowers/:id/toggle-status', borrower_controller_1.updateBorrowerStatus);
// Loans
router.get('/loans', loan_controller_1.getLoans);
router.post('/loans', loan_controller_1.createLoan);
router.get('/loans/:id', loan_controller_1.getLoanDetails);
router.post('/loans/:id/dates', loan_controller_1.updateLoanDates);
router.post('/loans/:id/rate', loan_controller_1.updateLoanRate);
router.post('/loans/:id/foreclose', loan_controller_1.forecloseLoan);
// Transactions
router.get('/transactions', transaction_controller_1.getTransactions);
router.post('/transactions', transaction_controller_1.createTransaction);
router.post('/transactions/:id', transaction_controller_1.updateTransaction);
// Wallet
router.get('/wallet', wallet_controller_1.getWallet);
// Reports
router.get('/reports/dashboard', report_controller_1.getDashboardStats);
exports.default = router;
