-- Generated-credential flags on "User" (final-defense step F3).
-- Additive and non-destructive: three nullable/defaulted columns, no data
-- touched. Every existing user gets mustChangePassword = false, so nobody
-- (the seeded coordinator included) is forced to change their password by
-- this migration — only accounts created or "resent" afterwards are.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "credentialsSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "credentialsEmailError" TEXT;
