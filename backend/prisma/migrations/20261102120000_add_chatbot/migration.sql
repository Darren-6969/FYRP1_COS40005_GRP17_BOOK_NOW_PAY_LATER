-- Chatbot (SRS 5.3.8 and the chatbot design): conversations, messages and
-- hand-offs; the policy library and Layer 1 answer templates; the AI models
-- page with its settings, change log and alert log.

-- CreateEnum
CREATE TYPE "ChatConversationStatus" AS ENUM ('OPEN', 'ESCALATED', 'CLOSED');
CREATE TYPE "ChatSenderRole" AS ENUM ('CUSTOMER', 'VISITOR', 'ASSISTANT', 'OPERATOR', 'ADMIN');
CREATE TYPE "ChatLayer" AS ENUM ('RULE', 'AI', 'HUMAN');
CREATE TYPE "ChatFeedback" AS ENUM ('UP', 'DOWN');
CREATE TYPE "ChatEscalationRoute" AS ENUM ('OPERATOR', 'ADMIN');
CREATE TYPE "ChatEscalationStatus" AS ENUM ('OPEN', 'ANSWERED', 'RESOLVED');
CREATE TYPE "PolicyAudience" AS ENUM ('PLATFORM', 'RENTAL');
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI', 'GOOGLE');
CREATE TYPE "AiPlan" AS ENUM ('FREE', 'PAID');

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "visitorToken" TEXT,
    "contactEmail" TEXT,
    "listingInViewId" INTEGER,
    "searchCriteria" JSONB,
    "status" "ChatConversationStatus" NOT NULL DEFAULT 'OPEN',
    "escalatedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "senderRole" "ChatSenderRole" NOT NULL,
    "senderId" INTEGER,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "layer" "ChatLayer",
    "aiModelId" INTEGER,
    "modelUsed" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(12,6),
    "errorType" TEXT,
    "toolsCalled" JSONB,
    "responseMs" INTEGER,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "checkFailed" BOOLEAN NOT NULL DEFAULT false,
    "feedback" "ChatFeedback",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_escalations" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "route" "ChatEscalationRoute" NOT NULL,
    "operatorId" INTEGER,
    "bookingId" INTEGER,
    "topic" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "assignedToId" INTEGER,
    "status" "ChatEscalationStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_escalations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "policy_documents" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" "PolicyAudience" NOT NULL DEFAULT 'PLATFORM',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "policy_sections" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" INTEGER,

    CONSTRAINT "policy_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_answer_templates" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "quickActionLabel" TEXT,
    "keywords" TEXT[],
    "placeholders" TEXT[],
    "body" TEXT NOT NULL,
    "signedInOnly" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_answer_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_models" (
    "id" SERIAL NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "plan" "AiPlan" NOT NULL DEFAULT 'FREE',
    "lastTestScore" DECIMAL(5,2),
    "lastTestAt" TIMESTAMP(3),
    "promptVersion" TEXT,
    "skippedUntil" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "priceInput" DECIMAL(10,4) NOT NULL,
    "priceOutput" DECIMAL(10,4) NOT NULL,
    "pricesCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthlyCapUsd" DECIMAL(10,2),
    "rpmLimit" INTEGER,
    "tpmLimit" INTEGER,
    "dailyLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "liveCustomerMode" BOOLEAN NOT NULL DEFAULT false,
    "monthlyCapUsd" DECIMAL(10,2) NOT NULL,
    "alertPercent" INTEGER NOT NULL DEFAULT 80,
    "messagesPerCustomerHour" INTEGER NOT NULL DEFAULT 20,
    "messagesPerIpHour" INTEGER NOT NULL DEFAULT 10,
    "maxMessageChars" INTEGER NOT NULL DEFAULT 500,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_model_changes" (
    "id" SERIAL NOT NULL,
    "modelId" INTEGER,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_changes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_alerts" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "modelId" INTEGER,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_conversations_customerId_lastMessageAt_idx" ON "chat_conversations"("customerId", "lastMessageAt");
CREATE INDEX "chat_conversations_visitorToken_idx" ON "chat_conversations"("visitorToken");
CREATE INDEX "chat_conversations_status_idx" ON "chat_conversations"("status");
CREATE INDEX "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt");
CREATE INDEX "chat_messages_aiModelId_createdAt_idx" ON "chat_messages"("aiModelId", "createdAt");
CREATE INDEX "chat_messages_layer_createdAt_idx" ON "chat_messages"("layer", "createdAt");
CREATE UNIQUE INDEX "chat_escalations_reference_key" ON "chat_escalations"("reference");
CREATE INDEX "chat_escalations_route_status_dueAt_idx" ON "chat_escalations"("route", "status", "dueAt");
CREATE INDEX "chat_escalations_operatorId_status_idx" ON "chat_escalations"("operatorId", "status");
CREATE INDEX "chat_escalations_conversationId_idx" ON "chat_escalations"("conversationId");
CREATE UNIQUE INDEX "policy_documents_key_key" ON "policy_documents"("key");
CREATE UNIQUE INDEX "policy_sections_documentId_key_version_key" ON "policy_sections"("documentId", "key", "version");
CREATE INDEX "policy_sections_documentId_key_idx" ON "policy_sections"("documentId", "key");
CREATE UNIQUE INDEX "chat_answer_templates_key_version_key" ON "chat_answer_templates"("key", "version");
CREATE INDEX "chat_answer_templates_key_idx" ON "chat_answer_templates"("key");
CREATE UNIQUE INDEX "ai_models_provider_modelName_key" ON "ai_models"("provider", "modelName");
CREATE INDEX "ai_models_position_idx" ON "ai_models"("position");
CREATE INDEX "ai_model_changes_modelId_changedAt_idx" ON "ai_model_changes"("modelId", "changedAt");
CREATE INDEX "ai_alerts_type_modelId_sentAt_idx" ON "ai_alerts"("type", "modelId", "sentAt");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_listingInViewId_fkey" FOREIGN KEY ("listingInViewId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_escalations" ADD CONSTRAINT "chat_escalations_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_escalations" ADD CONSTRAINT "chat_escalations_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_escalations" ADD CONSTRAINT "chat_escalations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_escalations" ADD CONSTRAINT "chat_escalations_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "policy_sections" ADD CONSTRAINT "policy_sections_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_sections" ADD CONSTRAINT "policy_sections_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_model_changes" ADD CONSTRAINT "ai_model_changes_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_model_changes" ADD CONSTRAINT "ai_model_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_alerts" ADD CONSTRAINT "ai_alerts_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
