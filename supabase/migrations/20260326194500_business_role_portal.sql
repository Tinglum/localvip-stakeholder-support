DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE 'business';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_description text,
  ADD COLUMN IF NOT EXISTS avg_ticket text,
  ADD COLUMN IF NOT EXISTS products_services text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS activation_status text DEFAULT 'not_started';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tag text,
  ADD COLUMN IF NOT EXISTS list_status text DEFAULT 'added',
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz;

ALTER TABLE outreach_activities
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

UPDATE businesses
SET owner_user_id = COALESCE(owner_user_id, owner_id)
WHERE owner_id IS NOT NULL;

UPDATE businesses
SET public_description = COALESCE(public_description, NULLIF(metadata->>'description', ''))
WHERE metadata IS NOT NULL;

UPDATE businesses
SET avg_ticket = COALESCE(avg_ticket, NULLIF(metadata->>'avg_ticket', ''))
WHERE metadata IS NOT NULL;

UPDATE businesses
SET products_services = COALESCE(
  NULLIF(products_services, '{}'::text[]),
  CASE
    WHEN NULLIF(metadata->>'products_services_text', '') IS NOT NULL
      THEN string_to_array(metadata->>'products_services_text', ',')
    ELSE NULL
  END,
  '{}'::text[]
)
WHERE metadata IS NOT NULL;

UPDATE contacts
SET created_by_user_id = COALESCE(created_by_user_id, owner_id)
WHERE owner_id IS NOT NULL;

UPDATE contacts
SET tag = COALESCE(tag, NULLIF(metadata->>'tag', ''))
WHERE metadata IS NOT NULL;

UPDATE contacts
SET list_status = COALESCE(
  list_status,
  CASE
    WHEN joined_at IS NOT NULL THEN 'joined'
    WHEN invited_at IS NOT NULL THEN 'invited'
    ELSE NULLIF(metadata->>'list_status', '')
  END,
  'added'
)
WHERE metadata IS NOT NULL OR joined_at IS NOT NULL OR invited_at IS NOT NULL;

UPDATE outreach_activities
SET user_id = COALESCE(user_id, performed_by)
WHERE performed_by IS NOT NULL;

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_activation_status_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_activation_status_check
  CHECK (activation_status IN ('not_started', 'in_progress', 'active'));

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_list_status_check;
ALTER TABLE contacts
  ADD CONSTRAINT contacts_list_status_check
  CHECK (list_status IN ('added', 'invited', 'joined'));

CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_owner_user_id ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by_user_id ON contacts(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_business_list_status ON contacts(business_id, list_status);
CREATE INDEX IF NOT EXISTS idx_outreach_activities_user_id ON outreach_activities(user_id);

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_business_id()
RETURNS uuid AS $$
  SELECT business_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS businesses_owner_select ON businesses;
CREATE POLICY businesses_owner_select ON businesses
  FOR SELECT USING (
    owner_id = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  );

DROP POLICY IF EXISTS businesses_owner_update ON businesses;
CREATE POLICY businesses_owner_update ON businesses
  FOR UPDATE USING (
    owner_id = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  );

DROP POLICY IF EXISTS businesses_business_profile_select ON businesses;
CREATE POLICY businesses_business_profile_select ON businesses
  FOR SELECT USING (id = current_user_business_id());

DROP POLICY IF EXISTS businesses_business_profile_update ON businesses;
CREATE POLICY businesses_business_profile_update ON businesses
  FOR UPDATE USING (id = current_user_business_id())
  WITH CHECK (id = current_user_business_id());

DROP POLICY IF EXISTS contacts_owner_select ON contacts;
CREATE POLICY contacts_owner_select ON contacts
  FOR SELECT USING (
    owner_id = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  );

DROP POLICY IF EXISTS contacts_owner_update ON contacts;
CREATE POLICY contacts_owner_update ON contacts
  FOR UPDATE USING (
    owner_id = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  );

DROP POLICY IF EXISTS contacts_business_select ON contacts;
CREATE POLICY contacts_business_select ON contacts
  FOR SELECT USING (business_id = current_user_business_id());

DROP POLICY IF EXISTS contacts_business_insert ON contacts;
CREATE POLICY contacts_business_insert ON contacts
  FOR INSERT WITH CHECK (
    business_id = current_user_business_id()
    AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
  );

DROP POLICY IF EXISTS contacts_business_update ON contacts;
CREATE POLICY contacts_business_update ON contacts
  FOR UPDATE USING (business_id = current_user_business_id())
  WITH CHECK (business_id = current_user_business_id());

DROP POLICY IF EXISTS contacts_business_delete ON contacts;
CREATE POLICY contacts_business_delete ON contacts
  FOR DELETE USING (business_id = current_user_business_id());

DROP POLICY IF EXISTS outreach_performer_select ON outreach_activities;
CREATE POLICY outreach_performer_select ON outreach_activities
  FOR SELECT USING (
    performed_by = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  );

DROP POLICY IF EXISTS outreach_performer_insert ON outreach_activities;
CREATE POLICY outreach_performer_insert ON outreach_activities
  FOR INSERT WITH CHECK (
    performed_by = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  );

DROP POLICY IF EXISTS outreach_business_select ON outreach_activities;
CREATE POLICY outreach_business_select ON outreach_activities
  FOR SELECT USING (business_id = current_user_business_id());

DROP POLICY IF EXISTS materials_select_active ON materials;
CREATE POLICY materials_select_active ON materials
  FOR SELECT USING (
    status = 'active'
    AND (
      COALESCE(current_user_role()::text, '') <> 'business'
      OR category = 'business_to_consumer'
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(target_roles, ARRAY[]::user_role[])) AS target_role
        WHERE target_role::text = 'business'
      )
    )
  );

DROP POLICY IF EXISTS campaigns_select ON campaigns;
CREATE POLICY campaigns_select ON campaigns
  FOR SELECT USING (
    COALESCE(current_user_role()::text, '') <> 'business'
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS onboarding_flows_owner_select ON onboarding_flows;
CREATE POLICY onboarding_flows_owner_select ON onboarding_flows
  FOR SELECT USING (
    owner_id = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  );

DROP POLICY IF EXISTS onboarding_steps_flow_owner_select ON onboarding_steps;
CREATE POLICY onboarding_steps_flow_owner_select ON onboarding_steps
  FOR SELECT USING (
    COALESCE(current_user_role()::text, '') <> 'business'
    AND EXISTS (
      SELECT 1 FROM onboarding_flows f
      WHERE f.id = onboarding_steps.flow_id AND f.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS qr_codes_creator_all ON qr_codes;
CREATE POLICY qr_codes_creator_all ON qr_codes
  FOR ALL USING (
    created_by = auth.uid()
    AND COALESCE(current_user_role()::text, '') <> 'business'
  );
