-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "subscription_bundles" ADD COLUMN     "auto_renew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "renewal_date" TIMESTAMP(3);

UPDATE "subscription_bundles"
SET "price" = CASE "tier"
    WHEN 'BASIC' THEN 9.99
    WHEN 'PRO' THEN 29.99
    ELSE 99.99
  END,
  "renewal_date" = "end_date";

ALTER TABLE "subscription_bundles" ALTER COLUMN "billing_cycle" DROP DEFAULT,
ALTER COLUMN "price" DROP DEFAULT;

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_payments_bundle_id_idx" ON "subscription_payments"("bundle_id");

-- CreateIndex
CREATE INDEX "subscription_bundles_status_end_date_idx" ON "subscription_bundles"("status", "end_date");

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "subscription_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
