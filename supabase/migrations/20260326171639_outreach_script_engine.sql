-- Outreach Script Engine schema extensions

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS linked_cause_id uuid REFERENCES causes(id),
  ADD COLUMN IF NOT EXISTS linked_material_id uuid REFERENCES materials(id),
  ADD COLUMN IF NOT EXISTS linked_qr_code_id uuid REFERENCES qr_codes(id),
  ADD COLUMN IF NOT EXISTS linked_qr_collection_id uuid REFERENCES qr_code_collections(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_script_tier') THEN
    CREATE TYPE outreach_script_tier AS ENUM ('good', 'better', 'best');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_script_channel') THEN
    CREATE TYPE outreach_script_channel AS ENUM ('in_person', 'text_dm', 'email', 'leave_behind');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_script_status') THEN
    CREATE TYPE outreach_script_status AS ENUM (
      'not_started',
      'copied',
      'sent',
      'delivered',
      'replied',
      'interested',
      'not_interested',
      'follow_up_needed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS outreach_scripts (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id             uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  cause_id                uuid REFERENCES causes(id),
  campaign_id             uuid REFERENCES campaigns(id),
  city_id                 uuid REFERENCES cities(id),
  contact_id              uuid REFERENCES contacts(id),
  created_by              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  script_category         text NOT NULL,
  script_type             text NOT NULL,
  script_tier             outreach_script_tier NOT NULL,
  channel                 outreach_script_channel NOT NULL,
  status                  outreach_script_status NOT NULL DEFAULT 'not_started',
  business_category       text,
  generated_content       text NOT NULL,
  final_content           text NOT NULL,
  was_edited              boolean NOT NULL DEFAULT false,
  notes                   text,
  copy_count              int NOT NULL DEFAULT 0,
  copied_at               timestamptz,
  sent_at                 timestamptz,
  delivered_at            timestamptz,
  replied_at              timestamptz,
  linked_material_id      uuid REFERENCES materials(id),
  linked_qr_code_id       uuid REFERENCES qr_codes(id),
  linked_qr_collection_id uuid REFERENCES qr_code_collections(id),
  personalization         jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outreach_activities
  ADD COLUMN IF NOT EXISTS outreach_script_id uuid REFERENCES outreach_scripts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_scripts_business_created_at
  ON outreach_scripts (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_scripts_creator_created_at
  ON outreach_scripts (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_scripts_city_created_at
  ON outreach_scripts (city_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_scripts_campaign_created_at
  ON outreach_scripts (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_scripts_status
  ON outreach_scripts (status);

CREATE INDEX IF NOT EXISTS idx_outreach_scripts_script_tier
  ON outreach_scripts (script_tier);

DROP TRIGGER IF EXISTS set_updated_at ON outreach_scripts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON outreach_scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE outreach_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outreach_scripts_admin_all ON outreach_scripts;
DROP POLICY IF EXISTS outreach_scripts_select_related ON outreach_scripts;
DROP POLICY IF EXISTS outreach_scripts_insert_own ON outreach_scripts;
DROP POLICY IF EXISTS outreach_scripts_update_own ON outreach_scripts;

CREATE POLICY outreach_scripts_admin_all ON outreach_scripts
  FOR ALL USING (is_admin());

CREATE POLICY outreach_scripts_select_related ON outreach_scripts
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = outreach_scripts.business_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM stakeholder_assignments sa
            WHERE sa.entity_type = 'business'
              AND sa.entity_id = b.id
              AND sa.stakeholder_id = auth.uid()
              AND sa.status = 'active'
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM causes c
      WHERE c.id = outreach_scripts.cause_id
        AND (
          c.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM stakeholder_assignments sa
            WHERE sa.entity_type = 'cause'
              AND sa.entity_id = c.id
              AND sa.stakeholder_id = auth.uid()
              AND sa.status = 'active'
          )
        )
    )
  );

CREATE POLICY outreach_scripts_insert_own ON outreach_scripts
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY outreach_scripts_update_own ON outreach_scripts
  FOR UPDATE USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
