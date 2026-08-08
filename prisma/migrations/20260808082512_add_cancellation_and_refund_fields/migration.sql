-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('none', 'pending', 'succeeded', 'failed');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" INTEGER,
ADD COLUMN     "refundStatus" "RefundStatus" NOT NULL DEFAULT 'none',
ADD COLUMN     "stripeRefundId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_stripeRefundId_key" ON "Reservation"("stripeRefundId");
