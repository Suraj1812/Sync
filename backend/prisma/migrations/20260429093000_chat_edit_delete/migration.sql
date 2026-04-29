ALTER TABLE "ConversationParticipant"
ADD COLUMN "clearedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Message"
ADD COLUMN "editedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "ConversationParticipant_conversationId_deletedAt_idx"
ON "ConversationParticipant"("conversationId", "deletedAt");

CREATE INDEX "Message_conversationId_deletedAt_createdAt_idx"
ON "Message"("conversationId", "deletedAt", "createdAt");
