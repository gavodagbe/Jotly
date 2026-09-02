-- AlterEnum
ALTER TYPE "RecurrenceFrequency" ADD VALUE IF NOT EXISTS 'quarterly';
ALTER TYPE "RecurrenceFrequency" ADD VALUE IF NOT EXISTS 'yearly';
