CREATE INDEX "User_isOnline_name_idx" ON "User"("isOnline", "name");
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
CREATE INDEX "Message_conversationId_seen_idx" ON "Message"("conversationId", "seen");
CREATE INDEX "Message_senderId_seen_idx" ON "Message"("senderId", "seen");
CREATE INDEX "Message_delivered_conversationId_idx" ON "Message"("delivered", "conversationId");
CREATE INDEX "CallLog_status_startedAt_idx" ON "CallLog"("status", "startedAt");
