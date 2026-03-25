-- ============================================================================
-- LocalVIP Stakeholder Support System - Initial Schema Migration
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Custom Types / Enums
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'internal_admin',
  'school_leader',
  'cause_leader',
  'business_onboarding',
  'influencer',
  'affiliate',
  'volunteer',
  'intern'
);

CREATE TYPE brand AS ENUM (
  'localvip',
  'hato'
);

CREATE TYPE entity_status AS ENUM (
  'active',
  'inactive',
  'pending',
  'archived'
);

CREATE TYPE onboarding_stage AS ENUM (
  'lead',
  'contacted',
  'interested',
  'in_progress',
  'onboarded',
  'live',
  'paused',
  'declined'
);

CREATE TYPE outreach_type AS ENUM (
  'call',
  'email',
  'text',
  'in_person',
  'social_media',
  'referral',
  'other'
);

CREATE TYPE task_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled'
);

-- ============================================================================
-- 2. Helper Functions
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if the current user is an admin (super_admin or internal_admin)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'internal_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 3. Tables
-- ============================================================================

-- ----- Cities -----
CREATE TABLE cities (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  state       text,
  country     text NOT NULL DEFAULT 'US',
  status      entity_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----- Organizations -----
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  type        text,
  brand       brand,
  city_id     uuid REFERENCES cities(id),
  website     text,
  email       text,
  phone       text,
  address     text,
  status      entity_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----- Profiles -----
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text,
  full_name       text,
  avatar_url      text,
  role            user_role NOT NULL DEFAULT 'volunteer',
  brand_context   brand,
  organization_id uuid REFERENCES organizations(id),
  city_id         uuid REFERENCES cities(id),
  referral_code   text UNIQUE,
  status          entity_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Campaigns -----
CREATE TABLE campaigns (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  description text,
  brand       brand,
  city_id     uuid REFERENCES cities(id),
  start_date  date,
  end_date    date,
  status      entity_status NOT NULL DEFAULT 'active',
  owner_id    uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----- Businesses -----
CREATE TABLE businesses (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  website         text,
  email           text,
  phone           text,
  address         text,
  city_id         uuid REFERENCES cities(id),
  category        text,
  brand           brand,
  stage           onboarding_stage NOT NULL DEFAULT 'lead',
  owner_id        uuid REFERENCES profiles(id),
  source          text,
  source_detail   text,
  campaign_id     uuid REFERENCES campaigns(id),
  duplicate_of    uuid REFERENCES businesses(id),
  external_id     text,
  status          entity_status NOT NULL DEFAULT 'active',
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Causes -----
CREATE TABLE causes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  type            text,
  organization_id uuid REFERENCES organizations(id),
  website         text,
  email           text,
  phone           text,
  address         text,
  city_id         uuid REFERENCES cities(id),
  brand           brand,
  stage           onboarding_stage NOT NULL DEFAULT 'lead',
  owner_id        uuid REFERENCES profiles(id),
  source          text,
  source_detail   text,
  campaign_id     uuid REFERENCES campaigns(id),
  duplicate_of    uuid REFERENCES causes(id),
  external_id     text,
  status          entity_status NOT NULL DEFAULT 'active',
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Contacts -----
CREATE TABLE contacts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name      text NOT NULL,
  last_name       text,
  email           text,
  phone           text,
  title           text,
  business_id     uuid REFERENCES businesses(id),
  cause_id        uuid REFERENCES causes(id),
  organization_id uuid REFERENCES organizations(id),
  owner_id        uuid REFERENCES profiles(id),
  source          text,
  duplicate_of    uuid REFERENCES contacts(id),
  status          entity_status NOT NULL DEFAULT 'active',
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Stakeholder Assignments -----
CREATE TABLE stakeholder_assignments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  role            text,
  assigned_by     uuid REFERENCES profiles(id),
  status          entity_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Outreach Activities -----
CREATE TABLE outreach_activities (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            outreach_type NOT NULL,
  subject         text,
  body            text,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  performed_by    uuid NOT NULL REFERENCES profiles(id),
  campaign_id     uuid REFERENCES campaigns(id),
  outcome         text,
  next_step       text,
  next_step_date  timestamptz,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Tasks -----
CREATE TABLE tasks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           text NOT NULL,
  description     text,
  priority        task_priority NOT NULL DEFAULT 'medium',
  status          task_status NOT NULL DEFAULT 'pending',
  assigned_to     uuid REFERENCES profiles(id),
  created_by      uuid NOT NULL REFERENCES profiles(id),
  entity_type     text,
  entity_id       uuid,
  due_date        timestamptz,
  completed_at    timestamptz,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Notes -----
CREATE TABLE notes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  content         text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  is_internal     boolean NOT NULL DEFAULT false,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Onboarding Flows -----
CREATE TABLE onboarding_flows (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  brand           brand,
  stage           onboarding_stage NOT NULL DEFAULT 'lead',
  owner_id        uuid REFERENCES profiles(id),
  campaign_id     uuid REFERENCES campaigns(id),
  started_at      timestamptz,
  completed_at    timestamptz,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Onboarding Steps -----
CREATE TABLE onboarding_steps (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id         uuid NOT NULL REFERENCES onboarding_flows(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  sort_order      int NOT NULL DEFAULT 0,
  is_required     boolean NOT NULL DEFAULT true,
  is_completed    boolean NOT NULL DEFAULT false,
  completed_by    uuid REFERENCES profiles(id),
  completed_at    timestamptz,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Materials -----
CREATE TABLE materials (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           text NOT NULL,
  description     text,
  type            text,
  brand           brand,
  file_url        text,
  file_name       text,
  file_size       bigint,
  mime_type       text,
  thumbnail_url   text,
  category        text,
  use_case        text,
  target_roles    user_role[],
  campaign_id     uuid REFERENCES campaigns(id),
  city_id         uuid REFERENCES cities(id),
  is_template     boolean NOT NULL DEFAULT false,
  version         int NOT NULL DEFAULT 1,
  status          entity_status NOT NULL DEFAULT 'active',
  created_by      uuid REFERENCES profiles(id),
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Material Assignments -----
CREATE TABLE material_assignments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id     uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  stakeholder_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by     uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- QR Code Collections -----
CREATE TABLE qr_code_collections (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  description     text,
  brand           brand,
  created_by      uuid REFERENCES profiles(id),
  status          entity_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- QR Codes -----
CREATE TABLE qr_codes (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                text NOT NULL,
  short_code          text NOT NULL UNIQUE,
  destination_url     text NOT NULL,
  redirect_url        text,
  brand               brand,
  logo_url            text,
  foreground_color    text NOT NULL DEFAULT '#000000',
  background_color    text NOT NULL DEFAULT '#FFFFFF',
  frame_text          text,
  campaign_id         uuid REFERENCES campaigns(id),
  city_id             uuid REFERENCES cities(id),
  stakeholder_id      uuid REFERENCES profiles(id),
  business_id         uuid REFERENCES businesses(id),
  cause_id            uuid REFERENCES causes(id),
  collection_id       uuid REFERENCES qr_code_collections(id),
  destination_preset  text,
  scan_count          int NOT NULL DEFAULT 0,
  version             int NOT NULL DEFAULT 1,
  status              entity_status NOT NULL DEFAULT 'active',
  created_by          uuid REFERENCES profiles(id),
  metadata            jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ----- QR Code Events -----
CREATE TABLE qr_code_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_code_id      uuid NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  ip_address      inet,
  user_agent      text,
  referrer        text,
  city            text,
  country         text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  scanned_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Redirects -----
CREATE TABLE redirects (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code      text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  qr_code_id      uuid REFERENCES qr_codes(id),
  click_count     int NOT NULL DEFAULT 0,
  status          entity_status NOT NULL DEFAULT 'active',
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Referrals -----
CREATE TABLE referrals (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id     uuid NOT NULL REFERENCES profiles(id),
  referral_code   text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  campaign_id     uuid REFERENCES campaigns(id),
  status          text NOT NULL DEFAULT 'pending',
  converted_at    timestamptz,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Analytics Rollups -----
CREATE TABLE analytics_rollups (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  period          text NOT NULL,
  period_start    date NOT NULL,
  dimension_type  text NOT NULL,
  dimension_id    uuid NOT NULL,
  metric          text NOT NULL,
  value           numeric NOT NULL DEFAULT 0,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Tags -----
CREATE TABLE tags (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  category        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ----- Entity Tags -----
CREATE TABLE entity_tags (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id          uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id, entity_type, entity_id)
);

-- ----- Audit Logs -----
CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid REFERENCES profiles(id),
  action          text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  old_values      jsonb,
  new_values      jsonb,
  ip_address      inet,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. Indexes
-- ============================================================================

-- Foreign key indexes
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_profiles_city_id ON profiles(city_id);

CREATE INDEX idx_organizations_city_id ON organizations(city_id);

CREATE INDEX idx_campaigns_city_id ON campaigns(city_id);
CREATE INDEX idx_campaigns_owner_id ON campaigns(owner_id);

CREATE INDEX idx_businesses_city_id ON businesses(city_id);
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_campaign_id ON businesses(campaign_id);
CREATE INDEX idx_businesses_duplicate_of ON businesses(duplicate_of);

CREATE INDEX idx_causes_city_id ON causes(city_id);
CREATE INDEX idx_causes_owner_id ON causes(owner_id);
CREATE INDEX idx_causes_campaign_id ON causes(campaign_id);
CREATE INDEX idx_causes_organization_id ON causes(organization_id);
CREATE INDEX idx_causes_duplicate_of ON causes(duplicate_of);

CREATE INDEX idx_contacts_business_id ON contacts(business_id);
CREATE INDEX idx_contacts_cause_id ON contacts(cause_id);
CREATE INDEX idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX idx_contacts_owner_id ON contacts(owner_id);
CREATE INDEX idx_contacts_duplicate_of ON contacts(duplicate_of);

CREATE INDEX idx_stakeholder_assignments_stakeholder_id ON stakeholder_assignments(stakeholder_id);
CREATE INDEX idx_stakeholder_assignments_assigned_by ON stakeholder_assignments(assigned_by);
CREATE INDEX idx_stakeholder_assignments_entity ON stakeholder_assignments(entity_type, entity_id);

CREATE INDEX idx_outreach_activities_performed_by ON outreach_activities(performed_by);
CREATE INDEX idx_outreach_activities_campaign_id ON outreach_activities(campaign_id);

CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);

CREATE INDEX idx_notes_created_by ON notes(created_by);

CREATE INDEX idx_onboarding_flows_owner_id ON onboarding_flows(owner_id);
CREATE INDEX idx_onboarding_flows_campaign_id ON onboarding_flows(campaign_id);
CREATE INDEX idx_onboarding_flows_entity ON onboarding_flows(entity_type, entity_id);

CREATE INDEX idx_onboarding_steps_flow_id ON onboarding_steps(flow_id);
CREATE INDEX idx_onboarding_steps_completed_by ON onboarding_steps(completed_by);

CREATE INDEX idx_materials_campaign_id ON materials(campaign_id);
CREATE INDEX idx_materials_city_id ON materials(city_id);
CREATE INDEX idx_materials_created_by ON materials(created_by);

CREATE INDEX idx_material_assignments_material_id ON material_assignments(material_id);
CREATE INDEX idx_material_assignments_stakeholder_id ON material_assignments(stakeholder_id);
CREATE INDEX idx_material_assignments_assigned_by ON material_assignments(assigned_by);

CREATE INDEX idx_qr_codes_campaign_id ON qr_codes(campaign_id);
CREATE INDEX idx_qr_codes_city_id ON qr_codes(city_id);
CREATE INDEX idx_qr_codes_business_id ON qr_codes(business_id);
CREATE INDEX idx_qr_codes_cause_id ON qr_codes(cause_id);
CREATE INDEX idx_qr_codes_collection_id ON qr_codes(collection_id);
CREATE INDEX idx_qr_codes_created_by ON qr_codes(created_by);

CREATE INDEX idx_qr_code_events_qr_code_id ON qr_code_events(qr_code_id);

CREATE INDEX idx_redirects_qr_code_id ON redirects(qr_code_id);
CREATE INDEX idx_redirects_created_by ON redirects(created_by);

CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_campaign_id ON referrals(campaign_id);

CREATE INDEX idx_entity_tags_tag_id ON entity_tags(tag_id);
CREATE INDEX idx_entity_tags_entity ON entity_tags(entity_type, entity_id);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Special / composite indexes
CREATE INDEX idx_businesses_name_normalized ON businesses(lower(trim(name)));
CREATE INDEX idx_businesses_domain ON businesses(lower(website)) WHERE website IS NOT NULL;
CREATE INDEX idx_businesses_city_status ON businesses(city_id, status);

CREATE INDEX idx_causes_name_normalized ON causes(lower(trim(name)));
CREATE INDEX idx_causes_city_status ON causes(city_id, status);

CREATE INDEX idx_contacts_email ON contacts(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_phone ON contacts(phone) WHERE phone IS NOT NULL;

CREATE INDEX idx_qr_codes_short_code ON qr_codes(short_code);
CREATE INDEX idx_qr_codes_stakeholder_id ON qr_codes(stakeholder_id);

CREATE INDEX idx_qr_code_events_qr_scanned ON qr_code_events(qr_code_id, scanned_at);

CREATE INDEX idx_outreach_activities_entity ON outreach_activities(entity_type, entity_id);

CREATE INDEX idx_redirects_short_code ON redirects(short_code);

CREATE INDEX idx_analytics_rollups_dimension_period ON analytics_rollups(dimension_type, dimension_id, period);

-- ============================================================================
-- 5. Updated_at Triggers
-- ============================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON causes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON stakeholder_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON outreach_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON onboarding_flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON onboarding_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON qr_code_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON qr_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON redirects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. Row Level Security
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE causes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_code_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_code_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ----- Profiles -----
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Prevent non-admins from changing their own role
    AND (role = (SELECT role FROM profiles WHERE id = auth.uid()) OR is_admin())
  );

CREATE POLICY profiles_admin_all ON profiles
  FOR ALL USING (is_admin());

-- ----- Organizations -----
CREATE POLICY organizations_select ON organizations
  FOR SELECT USING (true);

CREATE POLICY organizations_admin_all ON organizations
  FOR ALL USING (is_admin());

-- ----- Cities -----
CREATE POLICY cities_select ON cities
  FOR SELECT USING (true);

CREATE POLICY cities_admin_all ON cities
  FOR ALL USING (is_admin());

-- ----- Campaigns -----
CREATE POLICY campaigns_select ON campaigns
  FOR SELECT USING (true);

CREATE POLICY campaigns_admin_all ON campaigns
  FOR ALL USING (is_admin());

-- ----- Businesses -----
CREATE POLICY businesses_admin_all ON businesses
  FOR ALL USING (is_admin());

CREATE POLICY businesses_owner_select ON businesses
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY businesses_owner_update ON businesses
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY businesses_assigned_select ON businesses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stakeholder_assignments sa
      WHERE sa.entity_type = 'business'
        AND sa.entity_id = businesses.id
        AND sa.stakeholder_id = auth.uid()
        AND sa.status = 'active'
    )
  );

-- ----- Causes -----
CREATE POLICY causes_admin_all ON causes
  FOR ALL USING (is_admin());

CREATE POLICY causes_owner_select ON causes
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY causes_owner_update ON causes
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY causes_assigned_select ON causes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stakeholder_assignments sa
      WHERE sa.entity_type = 'cause'
        AND sa.entity_id = causes.id
        AND sa.stakeholder_id = auth.uid()
        AND sa.status = 'active'
    )
  );

-- ----- Contacts -----
CREATE POLICY contacts_admin_all ON contacts
  FOR ALL USING (is_admin());

CREATE POLICY contacts_owner_select ON contacts
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY contacts_owner_update ON contacts
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY contacts_assigned_select ON contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stakeholder_assignments sa
      WHERE sa.entity_type = 'contact'
        AND sa.entity_id = contacts.id
        AND sa.stakeholder_id = auth.uid()
        AND sa.status = 'active'
    )
  );

-- ----- Stakeholder Assignments -----
CREATE POLICY stakeholder_assignments_admin_all ON stakeholder_assignments
  FOR ALL USING (is_admin());

CREATE POLICY stakeholder_assignments_own_select ON stakeholder_assignments
  FOR SELECT USING (stakeholder_id = auth.uid());

-- ----- Outreach Activities -----
CREATE POLICY outreach_admin_all ON outreach_activities
  FOR ALL USING (is_admin());

CREATE POLICY outreach_performer_select ON outreach_activities
  FOR SELECT USING (performed_by = auth.uid());

CREATE POLICY outreach_performer_insert ON outreach_activities
  FOR INSERT WITH CHECK (performed_by = auth.uid());

-- ----- Tasks -----
CREATE POLICY tasks_admin_all ON tasks
  FOR ALL USING (is_admin());

CREATE POLICY tasks_assigned_select ON tasks
  FOR SELECT USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY tasks_assigned_update ON tasks
  FOR UPDATE USING (assigned_to = auth.uid());

-- ----- Notes -----
CREATE POLICY notes_admin_all ON notes
  FOR ALL USING (is_admin());

CREATE POLICY notes_creator_select ON notes
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY notes_entity_owner_select ON notes
  FOR SELECT USING (
    NOT is_internal
    AND (
      EXISTS (
        SELECT 1 FROM businesses b
        WHERE notes.entity_type = 'business' AND notes.entity_id = b.id AND b.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM causes c
        WHERE notes.entity_type = 'cause' AND notes.entity_id = c.id AND c.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM contacts ct
        WHERE notes.entity_type = 'contact' AND notes.entity_id = ct.id AND ct.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY notes_insert ON notes
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- ----- Onboarding Flows -----
CREATE POLICY onboarding_flows_admin_all ON onboarding_flows
  FOR ALL USING (is_admin());

CREATE POLICY onboarding_flows_owner_select ON onboarding_flows
  FOR SELECT USING (owner_id = auth.uid());

-- ----- Onboarding Steps -----
CREATE POLICY onboarding_steps_admin_all ON onboarding_steps
  FOR ALL USING (is_admin());

CREATE POLICY onboarding_steps_flow_owner_select ON onboarding_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM onboarding_flows f
      WHERE f.id = onboarding_steps.flow_id AND f.owner_id = auth.uid()
    )
  );

-- ----- Materials -----
CREATE POLICY materials_select_active ON materials
  FOR SELECT USING (status = 'active');

CREATE POLICY materials_admin_all ON materials
  FOR ALL USING (is_admin());

-- ----- Material Assignments -----
CREATE POLICY material_assignments_admin_all ON material_assignments
  FOR ALL USING (is_admin());

CREATE POLICY material_assignments_own_select ON material_assignments
  FOR SELECT USING (stakeholder_id = auth.uid());

-- ----- QR Codes -----
CREATE POLICY qr_codes_admin_all ON qr_codes
  FOR ALL USING (is_admin());

CREATE POLICY qr_codes_creator_all ON qr_codes
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY qr_codes_stakeholder_select ON qr_codes
  FOR SELECT USING (stakeholder_id = auth.uid());

-- ----- QR Code Collections -----
CREATE POLICY qr_code_collections_admin_all ON qr_code_collections
  FOR ALL USING (is_admin());

CREATE POLICY qr_code_collections_creator_select ON qr_code_collections
  FOR SELECT USING (created_by = auth.uid());

-- ----- QR Code Events -----
CREATE POLICY qr_code_events_admin_all ON qr_code_events
  FOR ALL USING (is_admin());

CREATE POLICY qr_code_events_insert ON qr_code_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY qr_code_events_qr_owner_select ON qr_code_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM qr_codes q
      WHERE q.id = qr_code_events.qr_code_id
        AND (q.created_by = auth.uid() OR q.stakeholder_id = auth.uid())
    )
  );

-- ----- Redirects -----
CREATE POLICY redirects_admin_all ON redirects
  FOR ALL USING (is_admin());

CREATE POLICY redirects_select ON redirects
  FOR SELECT USING (status = 'active');

-- ----- Referrals -----
CREATE POLICY referrals_admin_all ON referrals
  FOR ALL USING (is_admin());

CREATE POLICY referrals_referrer_select ON referrals
  FOR SELECT USING (referrer_id = auth.uid());

-- ----- Analytics Rollups -----
CREATE POLICY analytics_admin_select ON analytics_rollups
  FOR SELECT USING (is_admin());

CREATE POLICY analytics_admin_all ON analytics_rollups
  FOR ALL USING (is_admin());

-- ----- Tags -----
CREATE POLICY tags_select ON tags
  FOR SELECT USING (true);

CREATE POLICY tags_admin_all ON tags
  FOR ALL USING (is_admin());

-- ----- Entity Tags -----
CREATE POLICY entity_tags_select ON entity_tags
  FOR SELECT USING (true);

CREATE POLICY entity_tags_admin_all ON entity_tags
  FOR ALL USING (is_admin());

-- ----- Audit Logs -----
CREATE POLICY audit_logs_admin_select ON audit_logs
  FOR SELECT USING (is_admin());

CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 7. Duplicate Checking Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION check_business_duplicates(
  p_name text,
  p_website text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_city_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  website text,
  phone text,
  city_id uuid,
  match_type text,
  similarity_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.website,
    b.phone,
    b.city_id,
    CASE
      WHEN lower(trim(b.name)) = lower(trim(p_name)) THEN 'exact_name'
      WHEN p_website IS NOT NULL AND b.website IS NOT NULL
           AND lower(b.website) = lower(p_website) THEN 'exact_website'
      WHEN p_phone IS NOT NULL AND b.phone IS NOT NULL
           AND b.phone = p_phone THEN 'exact_phone'
      WHEN lower(trim(b.name)) LIKE '%' || lower(trim(p_name)) || '%'
           OR lower(trim(p_name)) LIKE '%' || lower(trim(b.name)) || '%' THEN 'partial_name'
      ELSE 'potential'
    END AS match_type,
    CASE
      WHEN lower(trim(b.name)) = lower(trim(p_name)) THEN 1.0
      WHEN p_website IS NOT NULL AND b.website IS NOT NULL
           AND lower(b.website) = lower(p_website) THEN 0.95
      WHEN p_phone IS NOT NULL AND b.phone IS NOT NULL
           AND b.phone = p_phone THEN 0.9
      WHEN lower(trim(b.name)) LIKE '%' || lower(trim(p_name)) || '%' THEN 0.7
      ELSE 0.5
    END AS similarity_score
  FROM businesses b
  WHERE b.duplicate_of IS NULL
    AND b.status != 'archived'
    AND (
      lower(trim(b.name)) = lower(trim(p_name))
      OR (p_website IS NOT NULL AND b.website IS NOT NULL AND lower(b.website) = lower(p_website))
      OR (p_phone IS NOT NULL AND b.phone IS NOT NULL AND b.phone = p_phone)
      OR (lower(trim(b.name)) LIKE '%' || lower(trim(p_name)) || '%')
      OR (lower(trim(p_name)) LIKE '%' || lower(trim(b.name)) || '%')
    )
    AND (p_city_id IS NULL OR b.city_id = p_city_id OR b.city_id IS NULL)
  ORDER BY similarity_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION check_cause_duplicates(
  p_name text,
  p_city_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  city_id uuid,
  match_type text,
  similarity_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.city_id,
    CASE
      WHEN lower(trim(c.name)) = lower(trim(p_name)) THEN 'exact_name'
      WHEN lower(trim(c.name)) LIKE '%' || lower(trim(p_name)) || '%'
           OR lower(trim(p_name)) LIKE '%' || lower(trim(c.name)) || '%' THEN 'partial_name'
      ELSE 'potential'
    END AS match_type,
    CASE
      WHEN lower(trim(c.name)) = lower(trim(p_name)) THEN 1.0
      WHEN lower(trim(c.name)) LIKE '%' || lower(trim(p_name)) || '%' THEN 0.7
      ELSE 0.5
    END AS similarity_score
  FROM causes c
  WHERE c.duplicate_of IS NULL
    AND c.status != 'archived'
    AND (
      lower(trim(c.name)) = lower(trim(p_name))
      OR lower(trim(c.name)) LIKE '%' || lower(trim(p_name)) || '%'
      OR lower(trim(p_name)) LIKE '%' || lower(trim(c.name)) || '%'
    )
    AND (p_city_id IS NULL OR c.city_id = p_city_id OR c.city_id IS NULL)
  ORDER BY similarity_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION check_contact_duplicates(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  match_type text,
  similarity_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.id,
    ct.first_name,
    ct.last_name,
    ct.email,
    ct.phone,
    CASE
      WHEN p_email IS NOT NULL AND ct.email IS NOT NULL
           AND lower(ct.email) = lower(p_email) THEN 'exact_email'
      WHEN p_phone IS NOT NULL AND ct.phone IS NOT NULL
           AND ct.phone = p_phone THEN 'exact_phone'
      ELSE 'potential'
    END AS match_type,
    CASE
      WHEN p_email IS NOT NULL AND ct.email IS NOT NULL
           AND lower(ct.email) = lower(p_email) THEN 1.0
      WHEN p_phone IS NOT NULL AND ct.phone IS NOT NULL
           AND ct.phone = p_phone THEN 0.9
      ELSE 0.5
    END AS similarity_score
  FROM contacts ct
  WHERE ct.duplicate_of IS NULL
    AND ct.status != 'archived'
    AND (
      (p_email IS NOT NULL AND ct.email IS NOT NULL AND lower(ct.email) = lower(p_email))
      OR (p_phone IS NOT NULL AND ct.phone IS NOT NULL AND ct.phone = p_phone)
    )
  ORDER BY similarity_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
