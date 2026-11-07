-- Chatbot AI providers become OpenAI, Mistral and Google. Claude (Anthropic)
-- and DeepSeek are removed with their ai_models rows. Chat messages, model
-- changes and alerts that pointed at those rows keep their history with the
-- model link cleared (ON DELETE SET NULL); chat_messages.model_used still
-- names the model.

DELETE FROM "ai_models" WHERE "provider"::text IN ('ANTHROPIC', 'DEEPSEEK');

-- Postgres cannot drop an enum value, so the type is rebuilt.
ALTER TYPE "AiProvider" RENAME TO "AiProvider_old";
CREATE TYPE "AiProvider" AS ENUM ('OPENAI', 'GOOGLE', 'MISTRAL');
ALTER TABLE "ai_models" ALTER COLUMN "provider" TYPE "AiProvider" USING ("provider"::text::"AiProvider");
DROP TYPE "AiProvider_old";

-- New order: GPT-6 Luna first, Mistral second (added by the chatbot seed),
-- Gemini third.
UPDATE "ai_models" SET "position" = 1 WHERE "provider" = 'OPENAI';
UPDATE "ai_models" SET "position" = 3 WHERE "provider" = 'GOOGLE';
