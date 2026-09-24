-- Add an administrator-controlled suspension state for individual listings.
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
