CREATE TABLE "MessageDeletion" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageDeletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageDeletion_messageId_userId_key"
ON "MessageDeletion"("messageId", "userId");

CREATE INDEX "MessageDeletion_messageId_idx"
ON "MessageDeletion"("messageId");

CREATE INDEX "MessageDeletion_userId_createdAt_idx"
ON "MessageDeletion"("userId", "createdAt");

ALTER TABLE "MessageDeletion"
ADD CONSTRAINT "MessageDeletion_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageDeletion"
ADD CONSTRAINT "MessageDeletion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
