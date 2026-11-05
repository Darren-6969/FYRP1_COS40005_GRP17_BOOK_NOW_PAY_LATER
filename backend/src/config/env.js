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

// Chatbot AI providers. All optional: a missing key switches that provider's
// models off (the chatbot falls back to the next model, then to the rule
// engine), and never stops the server.
const optional = (key) => {
  const value = (process.env[key] || "").trim();
  return value || null;
};

const env = {
  PORT: process.env.PORT,
  DB_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  AI_KEYS: {
    openai: optional("OPENAI_API_KEY"),
    google: optional("GEMINI_API_KEY"),
    mistral: optional("MISTRAL_API_KEY"),
  },
};

export default env;