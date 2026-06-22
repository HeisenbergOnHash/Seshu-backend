import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function main() {
  // Clean up
  await prisma.transaction.deleteMany();
  await prisma.foreclosure.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.borrower.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleaned up old data.');

  // Create Admin
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      phone: '1234567890',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      wallet: {
        create: {
          balance: 1000000,
          totalAssets: 500000,
        }
      }
    }
  });

  // Create Agent
  const agentPasswordHash = await bcrypt.hash('agent123', 10);
  const agent = await prisma.user.create({
    data: {
      name: 'Test Agent',
      phone: '0987654321',
      passwordHash: agentPasswordHash,
      role: 'AGENT',
      wallet: {
        create: {
          balance: 50000,
          totalAssets: 0,
        }
      }
    }
  });

  console.log('Created Users.');

  // Create Borrower
  const borrower1 = await prisma.borrower.create({
    data: {
      name: 'John Doe',
      phone: '1122334455',
      address: '123 Main St',
      agentId: agent.id,
    }
  });

  console.log('Created Borrower.');

  // Create Loan
  const loan1 = await prisma.loan.create({
    data: {
      principal: 10000,
      interestRate: 2,
      interestType: 'DAILY',
      startDate: dayjs().subtract(30, 'day').toDate(),
      dueDate: dayjs().add(60, 'day').toDate(),
      status: 'ACTIVE',
      borrowerId: borrower1.id,
      createdById: agent.id,
    }
  });

  console.log('Created Loan.');

  // Create some transactions
  await prisma.transaction.create({
    data: {
      type: 'CREDIT',
      amount: 10000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TXN123456',
      loanId: loan1.id,
      createdAt: dayjs().subtract(30, 'day').toDate(),
    }
  });

  await prisma.transaction.create({
    data: {
      type: 'INTEREST_COLLECTION',
      amount: 200,
      paymentMethod: 'CASH',
      loanId: loan1.id,
      createdAt: dayjs().subtract(15, 'day').toDate(),
    }
  });

  console.log('Created Transactions.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
