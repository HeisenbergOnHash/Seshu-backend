"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBorrowerStatus = exports.getBorrowerDetails = exports.createBorrower = exports.getBorrowers = void 0;
const prisma_1 = require("../utils/prisma");
const access_control_1 = require("../utils/access-control");
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
    try {
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        const borrower = await prisma_1.prisma.borrower.create({
            data: {
                name, phone, altPhone, address, idNumber, notes, agentId: user.userId
            }
        });
        res.json(borrower);
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err, 400);
        res.status(statusCode).json({ error: message });
    }
};
exports.createBorrower = createBorrower;
const getBorrowerDetails = async (req, res) => {
    try {
        const id = req.params.id;
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        await (0, access_control_1.ensureBorrowerOwnership)(user, id);
        const borrower = await prisma_1.prisma.borrower.findUnique({
            where: { id },
            include: { loans: true }
        });
        if (!borrower)
            return res.status(404).json({ error: 'Not found' });
        res.json(borrower);
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err);
        res.status(statusCode).json({ error: message });
    }
};
exports.getBorrowerDetails = getBorrowerDetails;
const updateBorrowerStatus = async (req, res) => {
    try {
        const id = req.params.id;
        const user = (0, access_control_1.ensureAuthenticatedUser)(req.user);
        const { isActive } = req.body;
        await (0, access_control_1.ensureBorrowerOwnership)(user, id);
        const borrower = await prisma_1.prisma.borrower.update({
            where: { id },
            data: { isActive }
        });
        res.json(borrower);
    }
    catch (err) {
        const { statusCode, message } = (0, access_control_1.handleHttpError)(err, 400);
        res.status(statusCode).json({ error: message });
    }
};
exports.updateBorrowerStatus = updateBorrowerStatus;
