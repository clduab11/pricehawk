-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "enable_daily_digest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_digest_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone_number" TEXT;

-- AlterTable
ALTER TABLE "validated_glitches" ADD COLUMN     "jina_ranked_at" TIMESTAMP(3),
ADD COLUMN     "jina_score" DECIMAL(5,4);

-- CreateIndex
CREATE INDEX "validated_glitches_is_glitch_validated_at_jina_score_idx" ON "validated_glitches"("is_glitch", "validated_at", "jina_score");

-- AddForeignKey
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
