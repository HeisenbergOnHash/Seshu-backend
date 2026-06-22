import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getBorrowers = async (req: Request, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.userId;

  const where = role === 'ADMIN' ? {} : { agentId: userId };
  const borrowers = await prisma.borrower.findMany({ where, include: { loans: true } });
  
  res.json(borrowers);
};

export const createBorrower = async (req: Request, res: Response) => {
  const { name, phone, altPhone, address, idNumber, notes } = req.body;
  const userId = req.user?.userId;

  try {
    const borrower = await prisma.borrower.create({
      data: {
        name, phone, altPhone, address, idNumber, notes, agentId: userId
      }
    });
    res.json(borrower);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const getBorrowerDetails = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const borrower = await prisma.borrower.findUnique({
    where: { id },
    include: { loans: true }
  });
  if (!borrower) return res.status(404).json({ error: 'Not found' });
  res.json(borrower);
};

export const updateBorrowerStatus = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { isActive } = req.body;

  try {
    const borrower = await prisma.borrower.update({
      where: { id },
      data: { isActive }
    });
    res.json(borrower);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};
