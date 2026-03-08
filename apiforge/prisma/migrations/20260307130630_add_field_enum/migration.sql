/*
  Warnings:

  - Added the required column `updatedAt` to the `fields` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "fields" ADD COLUMN "enumValues" JSONB,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "fields" ALTER COLUMN "updatedAt" DROP DEFAULT;
