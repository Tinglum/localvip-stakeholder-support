-- Stakeholder shell overhaul, business offer separation, and access scaffolding

DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE 'admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE 'business';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE 'field';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE 'launch_partner';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE 'community';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE outreach_script_tier ADD VALUE 'ultra';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_subtype text;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS launch_phase text;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS capture_offer_id uuid,
  ADD COLUMN IF NOT EXISTS normalized_email text,
  ADD COLUMN IF NOT EXISTS normalized_phone text;

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS target_subtypes text[] DEFAULT '{}'::text[];

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_capture_offer_id_fkey;

CREATE TABLE IF NOT EXISTS offers (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  offer_type        text NOT NULL,
  status            text NOT NULL DEFAULT 'draft',
  headline          text NOT NULL,
  description       text,
  value_type        text,
  value_label       text,
  cashback_percent  integer,
  starts_at         timestamptz,
  ends_at           timestamptz,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_offer_type_check CHECK (offer_type IN ('capture', 'cashback')),
  CONSTRAINT offers_status_check CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  CONSTRAINT offers_cashback_percent_check CHECK (
    cashback_percent IS NULL OR cashback_percent BETWEEN 5 AND 25
  )
);

ALTER TABLE contacts
  ADD CONSTRAINT contacts_capture_offer_id_fkey
  FOREIGN KEY (capture_offer_id) REFERENCES offers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS business_referrals (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_business_id    uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_by            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  target_business_name  text NOT NULL,
  target_city_id        uuid REFERENCES cities(id) ON DELETE SET NULL,
  target_category       text,
  target_contact_name   text,
  target_contact_email  text,
  target_contact_phone  text,
  channel               text NOT NULL DEFAULT 'other',
  message_snapshot      text,
  status                text NOT NULL DEFAULT 'sent',
  notes                 text,
  converted_business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_referrals_channel_check CHECK (channel IN ('sms', 'email', 'link_share', 'other')),
  CONSTRAINT business_referrals_status_check CHECK (status IN ('draft', 'sent', 'responded', 'converted', 'closed'))
);

CREATE TABLE IF NOT EXISTS city_access_requests (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_city_name text NOT NULL,
  requested_city_id   uuid REFERENCES cities(id) ON DELETE SET NULL,
  reason              text,
  status              text NOT NULL DEFAULT 'pending',
  reviewed_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT city_access_requests_status_check CHECK (status IN ('pending', 'approved', 'declined'))
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_access_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON offers;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON business_referrals;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON business_referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON city_access_requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON city_access_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_subtype_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_subtype_check
  CHECK (
    role_subtype IS NULL OR role_subtype IN (
      'intern',
      'volunteer',
      'school',
      'cause',
      'super',
      'internal'
    )
  );

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_launch_phase_check;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_launch_phase_check
  CHECK (
    launch_phase IS NULL OR launch_phase IN (
      'setup',
      'capturing_100',
      'ready_to_go_live',
      'live'
    )
  );

UPDATE profiles
SET role_subtype = CASE
  WHEN role::text = 'intern' THEN 'intern'
  WHEN role::text = 'volunteer' THEN 'volunteer'
  WHEN role::text = 'school_leader' THEN 'school'
  WHEN role::text = 'cause_leader' THEN 'cause'
  WHEN role::text = 'super_admin' THEN 'super'
  WHEN role::text = 'internal_admin' THEN 'internal'
  ELSE role_subtype
END
WHERE role_subtype IS NULL;

UPDATE businesses
SET launch_phase = CASE
  WHEN stage = 'live' THEN 'live'
  WHEN COALESCE((metadata->>'cashback_percent')::int, 10) BETWEEN 5 AND 25
    AND COALESCE(NULLIF(metadata->>'capture_offer_title', ''), NULLIF(metadata->>'offer_title', '')) IS NOT NULL
    AND COALESCE(public_description, NULLIF(metadata->>'description', '')) IS NOT NULL
    AND (SELECT COUNT(*) FROM contacts c WHERE c.business_id = businesses.id) >= 100
      THEN 'ready_to_go_live'
  WHEN COALESCE((metadata->>'cashback_percent')::int, 10) BETWEEN 5 AND 25
    AND COALESCE(NULLIF(metadata->>'capture_offer_title', ''), NULLIF(metadata->>'offer_title', '')) IS NOT NULL
    AND COALESCE(public_description, NULLIF(metadata->>'description', '')) IS NOT NULL
      THEN 'capturing_100'
  ELSE 'setup'
END
WHERE launch_phase IS NULL;

INSERT INTO offers (
  business_id,
  offer_type,
  status,
  headline,
  description,
  value_type,
  value_label,
  cashback_percent,
  starts_at,
  ends_at,
  metadata
)
SELECT
  b.id,
  'capture',
  CASE
    WHEN COALESCE(NULLIF(b.metadata->>'capture_offer_title', ''), NULLIF(b.metadata->>'offer_title', '')) IS NOT NULL THEN 'active'
    ELSE 'draft'
  END,
  COALESCE(NULLIF(b.metadata->>'capture_offer_title', ''), NULLIF(b.metadata->>'offer_title', ''), 'Join our list and get access to exclusive offers'),
  COALESCE(NULLIF(b.metadata->>'capture_offer_description', ''), NULLIF(b.metadata->>'offer_description', ''), 'This offer is only used to collect your first 100 customers before you go live.'),
  'label',
  COALESCE(NULLIF(b.metadata->>'capture_offer_value', ''), NULLIF(b.metadata->>'offer_value', '')),
  NULL,
  NULL,
  NULL,
  jsonb_build_object('source', 'business_metadata_backfill')
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1
  FROM offers o
  WHERE o.business_id = b.id
    AND o.offer_type = 'capture'
);

INSERT INTO offers (
  business_id,
  offer_type,
  status,
  headline,
  description,
  value_type,
  value_label,
  cashback_percent,
  starts_at,
  ends_at,
  metadata
)
SELECT
  b.id,
  'cashback',
  'active',
  COALESCE(NULLIF(b.metadata->>'cashback_offer_title', ''), 'Standard LocalVIP Cashback'),
  COALESCE(NULLIF(b.metadata->>'cashback_offer_description', ''), 'This is the percentage customers receive back when they shop with you through LocalVIP.'),
  'cashback_percent',
  CONCAT(COALESCE(NULLIF(b.metadata->>'cashback_percent', '')::int, 10), '% cashback'),
  COALESCE(NULLIF(b.metadata->>'cashback_percent', '')::int, 10),
  NULL,
  NULL,
  jsonb_build_object('source', 'business_metadata_backfill')
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1
  FROM offers o
  WHERE o.business_id = b.id
    AND o.offer_type = 'cashback'
);

UPDATE contacts c
SET capture_offer_id = o.id
FROM offers o
WHERE c.capture_offer_id IS NULL
  AND c.business_id = o.business_id
  AND o.offer_type = 'capture';

UPDATE contacts
SET normalized_email = lower(trim(email))
WHERE normalized_email IS NULL
  AND email IS NOT NULL;

UPDATE contacts
SET normalized_phone = regexp_replace(phone, '\D', '', 'g')
WHERE normalized_phone IS NULL
  AND phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_business_offer_type_unique
  ON offers (business_id, offer_type);

CREATE INDEX IF NOT EXISTS idx_offers_business_id
  ON offers (business_id);

CREATE INDEX IF NOT EXISTS idx_business_referrals_source_business_id
  ON business_referrals (source_business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_city_access_requests_requester_id
  ON city_access_requests (requester_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_business_normalized_email_unique
  ON contacts (business_id, normalized_email)
  WHERE business_id IS NOT NULL AND normalized_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_business_normalized_phone_unique
  ON contacts (business_id, normalized_phone)
  WHERE business_id IS NOT NULL AND normalized_phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_cause_normalized_email_unique
  ON contacts (cause_id, normalized_email)
  WHERE cause_id IS NOT NULL AND normalized_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_cause_normalized_phone_unique
  ON contacts (cause_id, normalized_phone)
  WHERE cause_id IS NOT NULL AND normalized_phone IS NOT NULL;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_business_id()
RETURNS uuid AS $$
  SELECT business_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_organization_id()
RETURNS uuid AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_city_id()
RETURNS uuid AS $$
  SELECT city_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_shell()
RETURNS text AS $$
  SELECT CASE
    WHEN role::text IN ('admin', 'super_admin', 'internal_admin') THEN 'admin'
    WHEN role::text = 'business' THEN 'business'
    WHEN role::text IN ('field', 'intern', 'volunteer') THEN 'field'
    WHEN role::text IN ('launch_partner', 'business_onboarding') THEN 'launch_partner'
    WHEN role::text IN ('community', 'school_leader', 'cause_leader') THEN 'community'
    WHEN role::text = 'influencer' THEN 'influencer'
    ELSE 'field'
  END
  FROM profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION role_array_contains(roles user_role[], expected text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(roles, ARRAY[]::user_role[])) AS role_value
    WHERE role_value::text = expected
  )
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION user_has_city_access(target_city_id uuid)
RETURNS boolean AS $$
  SELECT COALESCE(target_city_id = current_user_city_id(), false)
    OR EXISTS (
      SELECT 1
      FROM stakeholder_assignments sa
      WHERE sa.entity_type = 'city'
        AND sa.entity_id = target_city_id
        AND sa.stakeholder_id = auth.uid()
        AND sa.status = 'active'
    )
    OR is_admin()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS offers_admin_all ON offers;
DROP POLICY IF EXISTS offers_business_select ON offers;
DROP POLICY IF EXISTS offers_business_insert ON offers;
DROP POLICY IF EXISTS offers_business_update ON offers;

CREATE POLICY offers_admin_all ON offers
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY offers_business_select ON offers
  FOR SELECT USING (
    business_id = current_user_business_id()
    OR EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = offers.business_id
        AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY offers_business_insert ON offers
  FOR INSERT WITH CHECK (
    business_id = current_user_business_id()
    OR EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = offers.business_id
        AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY offers_business_update ON offers
  FOR UPDATE USING (
    business_id = current_user_business_id()
    OR EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = offers.business_id
        AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id = current_user_business_id()
    OR EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = offers.business_id
        AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS business_referrals_admin_all ON business_referrals;
DROP POLICY IF EXISTS business_referrals_business_select ON business_referrals;
DROP POLICY IF EXISTS business_referrals_business_insert ON business_referrals;
DROP POLICY IF EXISTS business_referrals_business_update ON business_referrals;

CREATE POLICY business_referrals_admin_all ON business_referrals
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY business_referrals_business_select ON business_referrals
  FOR SELECT USING (
    source_business_id = current_user_business_id()
    OR EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = business_referrals.source_business_id
        AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY business_referrals_business_insert ON business_referrals
  FOR INSERT WITH CHECK (
    source_business_id = current_user_business_id()
    OR EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = business_referrals.source_business_id
        AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY business_referrals_business_update ON business_referrals
  FOR UPDATE USING (
    source_business_id = current_user_business_id()
    OR EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = business_referrals.source_business_id
        AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    source_business_id = current_user_business_id()
    OR EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = business_referrals.source_business_id
        AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS city_access_requests_admin_all ON city_access_requests;
DROP POLICY IF EXISTS city_access_requests_requester_select ON city_access_requests;
DROP POLICY IF EXISTS city_access_requests_requester_insert ON city_access_requests;
DROP POLICY IF EXISTS city_access_requests_admin_update ON city_access_requests;

CREATE POLICY city_access_requests_admin_all ON city_access_requests
  FOR SELECT USING (is_admin());

CREATE POLICY city_access_requests_requester_select ON city_access_requests
  FOR SELECT USING (requester_id = auth.uid());

CREATE POLICY city_access_requests_requester_insert ON city_access_requests
  FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY city_access_requests_admin_update ON city_access_requests
  FOR UPDATE USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS businesses_field_summary_select ON businesses;
CREATE POLICY businesses_field_summary_select ON businesses
  FOR SELECT USING (
    current_user_shell() = 'field'
    AND status = 'active'
  );

DROP POLICY IF EXISTS businesses_launch_partner_city_select ON businesses;
CREATE POLICY businesses_launch_partner_city_select ON businesses
  FOR SELECT USING (
    current_user_shell() = 'launch_partner'
    AND user_has_city_access(city_id)
  );

DROP POLICY IF EXISTS causes_field_summary_select ON causes;
CREATE POLICY causes_field_summary_select ON causes
  FOR SELECT USING (
    current_user_shell() = 'field'
    AND status = 'active'
  );

DROP POLICY IF EXISTS causes_launch_partner_city_select ON causes;
CREATE POLICY causes_launch_partner_city_select ON causes
  FOR SELECT USING (
    current_user_shell() = 'launch_partner'
    AND user_has_city_access(city_id)
  );

DROP POLICY IF EXISTS causes_community_self_select ON causes;
CREATE POLICY causes_community_self_select ON causes
  FOR SELECT USING (
    current_user_shell() = 'community'
    AND (
      owner_id = auth.uid()
      OR organization_id = current_user_organization_id()
    )
  );

DROP POLICY IF EXISTS contacts_community_select ON contacts;
CREATE POLICY contacts_community_select ON contacts
  FOR SELECT USING (
    current_user_shell() = 'community'
    AND EXISTS (
      SELECT 1
      FROM causes c
      WHERE c.id = contacts.cause_id
        AND (
          c.owner_id = auth.uid()
          OR c.organization_id = current_user_organization_id()
        )
    )
  );

DROP POLICY IF EXISTS materials_select_active ON materials;
CREATE POLICY materials_select_active ON materials
  FOR SELECT USING (
    status = 'active'
    AND (
      is_admin()
      OR (
        current_user_shell() = 'business'
        AND (
          category IN ('customer_capture', 'localvip_live', 'business_to_business', 'business_to_consumer', 'general')
          OR role_array_contains(target_roles, 'business')
        )
      )
      OR (
        current_user_shell() = 'field'
        AND (
          category IN ('field_outreach', 'general', 'partner_outreach', 'business_onboarding')
          OR role_array_contains(target_roles, 'field')
          OR role_array_contains(target_roles, 'intern')
          OR role_array_contains(target_roles, 'volunteer')
        )
      )
      OR (
        current_user_shell() = 'launch_partner'
        AND (
          category IN ('launch_partner', 'partner_outreach', 'general')
          OR role_array_contains(target_roles, 'launch_partner')
          OR role_array_contains(target_roles, 'business_onboarding')
        )
      )
      OR (
        current_user_shell() = 'community'
        AND (
          category IN ('community_mobilization', 'general')
          OR role_array_contains(target_roles, 'community')
          OR role_array_contains(target_roles, 'school_leader')
          OR role_array_contains(target_roles, 'cause_leader')
        )
      )
      OR (
        current_user_shell() = 'influencer'
        AND (
          category IN ('influencer_referral', 'general')
          OR role_array_contains(target_roles, 'influencer')
        )
      )
    )
  );
