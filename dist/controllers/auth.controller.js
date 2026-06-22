"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../utils/prisma");
const env_1 = require("../utils/env");
const login = async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
        return res.status(400).json({ error: 'Phone and password are required' });
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { phone } });
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, (0, env_1.getJwtSecret)(), { expiresIn: '7d' });
    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
        }
    });
};
exports.login = login;
const getMe = async (req, res) => {
    const userId = req.user?.userId;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, phone: true, role: true }
    });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    res.json(user);
};
exports.getMe = getMe;
