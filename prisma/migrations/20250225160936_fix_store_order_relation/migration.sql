/*
  Warnings:

  - You are about to drop the column `isSent` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Order` DROP COLUMN `isSent`,
    ADD COLUMN `address` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `pesapalTrackingId` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `Store` ADD COLUMN `pesapalIpnId` VARCHAR(191) NULL,
    ADD COLUMN `pesapalIpnUrl` VARCHAR(191) NULL;
