import { loadEnvFile } from "./env.js";

loadEnvFile();

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getNumberEnv(name, fallback) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number.`);
  }

  return parsedValue;
}

export const config = {
  telegramBotToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
  openaiApiKey: getRequiredEnv("OPENAI_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openaiMaxOutputTokens: getNumberEnv("OPENAI_MAX_OUTPUT_TOKENS", 900),
  newsArticleLimit: getNumberEnv("NEWS_ARTICLE_LIMIT", 6),
  pollingTimeoutSeconds: getNumberEnv("POLLING_TIMEOUT_SECONDS", 30),
  newsHl: process.env.NEWS_HL || "en-IN",
  newsGl: process.env.NEWS_GL || "IN",
  newsCeid: process.env.NEWS_CEID || "IN:en"
};
