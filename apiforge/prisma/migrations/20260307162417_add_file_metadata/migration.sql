/*
  Warnings:

  - Added the required column `updatedAt` to the `files` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "files" ADD COLUMN     "alt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "copyright" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "focus" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "metaData" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "files" ALTER COLUMN "updatedAt" DROP DEFAULT;
