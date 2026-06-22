"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const api_routes_1 = __importDefault(require("./routes/api.routes"));
const env_1 = require("./utils/env");
const cors_2 = require("./config/cors");
dotenv_1.default.config();
(0, env_1.getJwtSecret)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)(cors_2.corsOptions));
app.options('*', (0, cors_1.default)(cors_2.corsOptions));
app.use(express_1.default.json());
app.use('/api/auth', auth_routes_1.default);
app.use('/api', api_routes_1.default);
app.get('/health', (req, res) => {
    res.send('OK');
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
