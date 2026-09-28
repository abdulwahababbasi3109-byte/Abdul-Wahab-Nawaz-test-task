-- DropForeignKey
ALTER TABLE "subscription_payments" DROP CONSTRAINT "subscription_payments_bundle_id_fkey";

-- DropTable
DROP TABLE "subscription_payments";

-- DropEnum
DROP TYPE "PaymentStatus";

