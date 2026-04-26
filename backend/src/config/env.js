import dotenv from 'dotenv';

dotenv.config();

const requiredEnv = [
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET'
];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
});

const env = {
  PORT: process.env.PORT,
  DB_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
};

export default env;