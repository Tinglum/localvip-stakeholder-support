-- ============================================================
-- Migration: Business media, material versioning, template rules, notifications
-- Date: 2026-03-31
-- ============================================================

-- 1. Business media columns
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cover_photo_url text;

-- 2. Generated material versioning columns
ALTER TABLE generated_materials ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1;
ALTER TABLE generated_materials ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Allow multiple versions per stakeholder+template
ALTER TABLE generated_materials DROP CONSTRAINT IF EXISTS generated_materials_stakeholder_id_template_id_key;

CREATE INDEX IF NOT EXISTS idx_gm_active
  ON generated_materials(stakeholder_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_gm_stakeholder_template
  ON generated_materials(stakeholder_id, template_id, version_number DESC);

-- 3. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  entity_type text,
  entity_id uuid,
  is_read boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on notifications"
  ON notifications FOR ALL
  USING (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE NOT is_read;

-- 4. Template rules table
CREATE TABLE IF NOT EXISTS template_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  stakeholder_type text,
  city_id uuid,
  campaign_id uuid,
  audience_tag text,
  template_id uuid NOT NULL,
  rule_type text DEFAULT 'include' CHECK (rule_type IN ('include', 'exclude')),
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE template_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage template rules"
  ON template_rules FOR ALL
  USING (true);

CREATE INDEX IF NOT EXISTS idx_template_rules_active
  ON template_rules(is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_template_rules_stakeholder_type
  ON template_rules(stakeholder_type, is_active)
  WHERE is_active = true;
