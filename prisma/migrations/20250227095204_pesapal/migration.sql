/*
  Warnings:

  - You are about to drop the column `shippingDetailsId` on the `Order` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[orderId]` on the table `ShippingDetails` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `Order_shippingDetailsId_key` ON `Order`;

-- AlterTable
ALTER TABLE `Order` DROP COLUMN `shippingDetailsId`,
    ADD COLUMN `paymentAccount` VARCHAR(191) NULL,
    ADD COLUMN `paymentConfirmationCode` VARCHAR(191) NULL,
    ADD COLUMN `paymentDate` DATETIME(3) NULL,
    ADD COLUMN `paymentDescription` VARCHAR(191) NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `ShippingDetails` ADD COLUMN `orderId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ShippingDetails_orderId_key` ON `ShippingDetails`(`orderId`);

-- CreateIndex
CREATE INDEX `ShippingDetails_orderId_idx` ON `ShippingDetails`(`orderId`);
