-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "twitter_access_token" TEXT,
ADD COLUMN     "twitter_expires_at" TIMESTAMP(3),
ADD COLUMN     "twitter_refresh_token" TEXT;

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "postId" TEXT,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "glitchId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engagement" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterIssue" (
    "id" TEXT NOT NULL,
    "beehiivPostId" TEXT,
    "title" TEXT NOT NULL,
    "dealCount" INTEGER NOT NULL,
    "audienceType" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "opens" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPost_platform_postedAt_idx" ON "SocialPost"("platform", "postedAt");

-- CreateIndex
CREATE INDEX "SocialPost_glitchId_idx" ON "SocialPost"("glitchId");

-- CreateIndex
CREATE INDEX "NewsletterIssue_scheduledFor_idx" ON "NewsletterIssue"("scheduledFor");

-- CreateIndex
CREATE INDEX "NewsletterIssue_audienceType_idx" ON "NewsletterIssue"("audienceType");

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_glitchId_fkey" FOREIGN KEY ("glitchId") REFERENCES "validated_glitches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
