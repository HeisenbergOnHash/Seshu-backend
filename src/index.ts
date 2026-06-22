import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import apiRoutes from './routes/api.routes';
import { getJwtSecret } from './utils/env';
import { corsOptions } from './config/cors';

dotenv.config();
getJwtSecret();

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.send('OK');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
