-- What the chat window draws for an assistant message (cards, options, links).
ALTER TABLE "chat_messages" ADD COLUMN "payload" JSONB;
