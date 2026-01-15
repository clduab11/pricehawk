-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "enable_telegram" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enable_whatsapp" BOOLEAN NOT NULL DEFAULT false;
