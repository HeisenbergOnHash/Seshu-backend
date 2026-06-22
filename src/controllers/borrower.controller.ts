import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import {
  ensureAuthenticatedUser,
  ensureBorrowerOwnership,
  handleHttpError
} from '../utils/access-control';

export const getBorrowers = async (req: Request, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.userId;

  const where = role === 'ADMIN' ? {} : { agentId: userId };
  const borrowers = await prisma.borrower.findMany({ where, include: { loans: true } });
  
  res.json(borrowers);
};

export const createBorrower = async (req: Request, res: Response) => {
  const { name, phone, altPhone, address, idNumber, notes } = req.body;

  try {
    const user = ensureAuthenticatedUser(req.user);
    const borrower = await prisma.borrower.create({
      data: {
        name, phone, altPhone, address, idNumber, notes, agentId: user.userId
      }
    });
    res.json(borrower);
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err, 400);
    res.status(statusCode).json({ error: message });
  }
};

export const getBorrowerDetails = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = ensureAuthenticatedUser(req.user);
    await ensureBorrowerOwnership(user, id);

    const borrower = await prisma.borrower.findUnique({
      where: { id },
      include: { loans: true }
    });
    if (!borrower) return res.status(404).json({ error: 'Not found' });
    res.json(borrower);
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err);
    res.status(statusCode).json({ error: message });
  }
};

export const updateBorrowerStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = ensureAuthenticatedUser(req.user);
    const { isActive } = req.body;

    await ensureBorrowerOwnership(user, id);

    const borrower = await prisma.borrower.update({
      where: { id },
      data: { isActive }
    });
    res.json(borrower);
  } catch (err: unknown) {
    const { statusCode, message } = handleHttpError(err, 400);
    res.status(statusCode).json({ error: message });
  }
};
