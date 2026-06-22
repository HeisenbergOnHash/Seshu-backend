"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBorrowerStatus = exports.getBorrowerDetails = exports.createBorrower = exports.getBorrowers = void 0;
const prisma_1 = require("../utils/prisma");
const getBorrowers = async (req, res) => {
    const role = req.user?.role;
    const userId = req.user?.userId;
    const where = role === 'ADMIN' ? {} : { agentId: userId };
    const borrowers = await prisma_1.prisma.borrower.findMany({ where, include: { loans: true } });
    res.json(borrowers);
};
exports.getBorrowers = getBorrowers;
const createBorrower = async (req, res) => {
    const { name, phone, altPhone, address, idNumber, notes } = req.body;
    const userId = req.user?.userId;
    try {
        const borrower = await prisma_1.prisma.borrower.create({
            data: {
                name, phone, altPhone, address, idNumber, notes, agentId: userId
            }
        });
        res.json(borrower);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};
exports.createBorrower = createBorrower;
const getBorrowerDetails = async (req, res) => {
    const id = req.params.id;
    const borrower = await prisma_1.prisma.borrower.findUnique({
        where: { id },
        include: { loans: true }
    });
    if (!borrower)
        return res.status(404).json({ error: 'Not found' });
    res.json(borrower);
};
exports.getBorrowerDetails = getBorrowerDetails;
const updateBorrowerStatus = async (req, res) => {
    const id = req.params.id;
    const { isActive } = req.body;
    try {
        const borrower = await prisma_1.prisma.borrower.update({
            where: { id },
            data: { isActive }
        });
        res.json(borrower);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};
exports.updateBorrowerStatus = updateBorrowerStatus;
