-- ============================================================
-- Migration: Add logo_url and cover_photo_url to causes table
-- Date: 2026-04-05
-- ============================================================

ALTER TABLE causes ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE causes ADD COLUMN IF NOT EXISTS cover_photo_url text;
