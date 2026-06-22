import cors from 'cors';

const defaultOrigins = [
  'https://seshu.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = (process.env.CORS_ORIGINS || defaultOrigins.join(','))
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!origin || allowed.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
