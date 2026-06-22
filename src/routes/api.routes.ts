import { Router } from 'express';
import { getBorrowers, createBorrower, getBorrowerDetails, updateBorrowerStatus } from '../controllers/borrower.controller';
import { getLoans, createLoan, getLoanDetails, updateLoanRate, forecloseLoan, updateLoanDates } from '../controllers/loan.controller';
import { getTransactions, createTransaction, updateTransaction } from '../controllers/transaction.controller';
import { getWallet } from '../controllers/wallet.controller';
import { getDashboardStats } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

// Borrowers
router.get('/borrowers', getBorrowers);
router.post('/borrowers', createBorrower);
router.get('/borrowers/:id', getBorrowerDetails);
router.post('/borrowers/:id/toggle-status', updateBorrowerStatus);

// Loans
router.get('/loans', getLoans);
router.post('/loans', createLoan);
router.get('/loans/:id', getLoanDetails);
router.post('/loans/:id/dates', updateLoanDates);
router.post('/loans/:id/rate', updateLoanRate);
router.post('/loans/:id/foreclose', forecloseLoan);

// Transactions
router.get('/transactions', getTransactions);
router.post('/transactions', createTransaction);
router.post('/transactions/:id', updateTransaction);

// Wallet
router.get('/wallet', getWallet);

// Reports
router.get('/reports/dashboard', getDashboardStats);

export default router;
