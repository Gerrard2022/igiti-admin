/*
  Warnings:

  - You are about to drop the column `address` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `variantId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the `Color` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Size` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Variant` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[shippingDetailsId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `inStock` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `OrderItem_variantId_idx` ON `OrderItem`;

-- AlterTable
ALTER TABLE `Order` DROP COLUMN `address`,
    DROP COLUMN `phone`,
    ADD COLUMN `shippingDetailsId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `OrderItem` DROP COLUMN `variantId`;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `inStock` INTEGER NOT NULL;

-- DropTable
DROP TABLE `Color`;

-- DropTable
DROP TABLE `Size`;

-- DropTable
DROP TABLE `Variant`;

-- CreateTable
CREATE TABLE `ShippingDetails` (
    `id` VARCHAR(191) NOT NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `zipCode` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Order_shippingDetailsId_key` ON `Order`(`shippingDetailsId`);
