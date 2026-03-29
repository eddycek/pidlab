-- Migration: Add beta whitelist support
-- Run AFTER schema.sql (which creates beta_whitelist table)

-- Add whitelist_id column to existing licenses table
ALTER TABLE licenses ADD COLUMN whitelist_id TEXT;
