-- CreateEnum
CREATE TYPE "QuotaSource" AS ENUM ('FREE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "BundleTier" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BundleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "quota_source" "QuotaSource" NOT NULL,
    "bundle_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_usages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "free_messages_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_bundles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tier" "BundleTier" NOT NULL,
    "max_messages" INTEGER,
    "messages_used" INTEGER NOT NULL DEFAULT 0,
    "status" "BundleStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "chat_messages_user_id_created_at_idx" ON "chat_messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_bundle_id_idx" ON "chat_messages"("bundle_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_usages_user_id_period_key" ON "monthly_usages"("user_id", "period");

-- CreateIndex
CREATE INDEX "subscription_bundles_user_id_status_end_date_idx" ON "subscription_bundles"("user_id", "status", "end_date");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "subscription_bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_usages" ADD CONSTRAINT "monthly_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_bundles" ADD CONSTRAINT "subscription_bundles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
