-- Dynamic stakeholder material engine

CREATE TABLE IF NOT EXISTS stakeholders (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type              text NOT NULL,
  name              text NOT NULL,
  city_id           uuid REFERENCES cities(id) ON DELETE SET NULL,
  owner_user_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  profile_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  business_id       uuid REFERENCES businesses(id) ON DELETE SET NULL,
  cause_id          uuid REFERENCES causes(id) ON DELETE SET NULL,
  organization_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  status            entity_status NOT NULL DEFAULT 'pending',
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stakeholders_type_check CHECK (
    type IN ('business', 'school', 'cause', 'launch_partner', 'influencer', 'field', 'community')
  )
);

CREATE TABLE IF NOT EXISTS stakeholder_codes (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id    uuid NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  referral_code     text NOT NULL,
  connection_code   text NOT NULL,
  join_url          text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_templates (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              text NOT NULL,
  source_path       text,
  template_type     text NOT NULL DEFAULT 'structured_svg',
  output_format     text NOT NULL DEFAULT 'svg',
  audience_tags     text[] NOT NULL DEFAULT '{}'::text[],
  stakeholder_types text[] NOT NULL DEFAULT '{}'::text[],
  library_folder    text NOT NULL,
  qr_position_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_templates_output_format_check CHECK (output_format IN ('svg', 'png', 'pdf')),
  CONSTRAINT material_templates_library_folder_check CHECK (
    library_folder IN (
      'share_with_customers',
      'share_with_businesses',
      'share_with_schools',
      'share_with_parents',
      'share_with_pta'
    )
  )
);

CREATE TABLE IF NOT EXISTS generated_materials (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id      uuid NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  template_id         uuid NOT NULL REFERENCES material_templates(id) ON DELETE CASCADE,
  material_id         uuid REFERENCES materials(id) ON DELETE SET NULL,
  generated_file_url  text,
  generated_file_name text,
  library_folder      text NOT NULL,
  tags                text[] NOT NULL DEFAULT '{}'::text[],
  generation_status   text NOT NULL DEFAULT 'pending',
  generation_error    text,
  generated_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT generated_materials_generation_status_check CHECK (
    generation_status IN ('pending', 'generated', 'failed')
  )
);

CREATE TABLE IF NOT EXISTS admin_tasks (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id uuid NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  task_type     text NOT NULL,
  title         text NOT NULL,
  status        text NOT NULL DEFAULT 'needs_setup',
  payload_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_at        timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_tasks_status_check CHECK (
    status IN ('needs_setup', 'ready_to_generate', 'generated', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholders_business_unique
  ON stakeholders (business_id)
  WHERE business_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholders_cause_unique
  ON stakeholders (cause_id)
  WHERE cause_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholders_profile_unique
  ON stakeholders (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholder_codes_referral_code_unique
  ON stakeholder_codes (lower(referral_code));

CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholder_codes_connection_code_unique
  ON stakeholder_codes (lower(connection_code));

CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholder_codes_stakeholder_unique
  ON stakeholder_codes (stakeholder_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_materials_unique
  ON generated_materials (stakeholder_id, template_id);

CREATE INDEX IF NOT EXISTS idx_material_templates_active
  ON material_templates (is_active, library_folder);

CREATE INDEX IF NOT EXISTS idx_generated_materials_stakeholder
  ON generated_materials (stakeholder_id, library_folder, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_status
  ON admin_tasks (status, updated_at DESC);

ALTER TABLE stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_stakeholders ON stakeholders;
CREATE TRIGGER set_updated_at_stakeholders
  BEFORE UPDATE ON stakeholders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_stakeholder_codes ON stakeholder_codes;
CREATE TRIGGER set_updated_at_stakeholder_codes
  BEFORE UPDATE ON stakeholder_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_material_templates ON material_templates;
CREATE TRIGGER set_updated_at_material_templates
  BEFORE UPDATE ON material_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_generated_materials ON generated_materials;
CREATE TRIGGER set_updated_at_generated_materials
  BEFORE UPDATE ON generated_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_admin_tasks ON admin_tasks;
CREATE TRIGGER set_updated_at_admin_tasks
  BEFORE UPDATE ON admin_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION create_stakeholder_setup_task()
RETURNS trigger AS $$
BEGIN
  INSERT INTO admin_tasks (
    stakeholder_id,
    task_type,
    title,
    status,
    payload_json
  ) VALUES (
    NEW.id,
    'stakeholder_setup',
    CONCAT('Complete setup for ', NEW.name),
    'needs_setup',
    jsonb_build_object(
      'checklist', jsonb_build_array(
        'Add referral code',
        'Add connection code',
        'Generate materials'
      ),
      'stakeholder_type', NEW.type
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_stakeholder_setup_task_trigger ON stakeholders;
CREATE TRIGGER create_stakeholder_setup_task_trigger
  AFTER INSERT ON stakeholders
  FOR EACH ROW EXECUTE FUNCTION create_stakeholder_setup_task();

CREATE OR REPLACE FUNCTION mark_stakeholder_task_ready()
RETURNS trigger AS $$
BEGIN
  UPDATE admin_tasks
  SET
    status = 'ready_to_generate',
    payload_json = jsonb_set(
      COALESCE(payload_json, '{}'::jsonb),
      '{codes_saved_at}',
      to_jsonb(now())
    )
  WHERE stakeholder_id = NEW.stakeholder_id
    AND task_type = 'stakeholder_setup'
    AND status IN ('needs_setup', 'failed');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mark_stakeholder_task_ready_trigger ON stakeholder_codes;
CREATE TRIGGER mark_stakeholder_task_ready_trigger
  AFTER INSERT OR UPDATE ON stakeholder_codes
  FOR EACH ROW EXECUTE FUNCTION mark_stakeholder_task_ready();

DROP POLICY IF EXISTS stakeholders_admin_all ON stakeholders;
CREATE POLICY stakeholders_admin_all ON stakeholders
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS stakeholders_owner_select ON stakeholders;
CREATE POLICY stakeholders_owner_select ON stakeholders
  FOR SELECT USING (
    profile_id = auth.uid()
    OR owner_user_id = auth.uid()
    OR (current_user_shell() = 'business' AND business_id = current_user_business_id())
    OR (
      current_user_shell() = 'community'
      AND EXISTS (
        SELECT 1
        FROM causes c
        WHERE c.id = stakeholders.cause_id
          AND (
            c.owner_id = auth.uid()
            OR c.organization_id = current_user_organization_id()
          )
      )
    )
  );

DROP POLICY IF EXISTS stakeholder_codes_admin_all ON stakeholder_codes;
CREATE POLICY stakeholder_codes_admin_all ON stakeholder_codes
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS material_templates_admin_all ON material_templates;
CREATE POLICY material_templates_admin_all ON material_templates
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS generated_materials_admin_all ON generated_materials;
CREATE POLICY generated_materials_admin_all ON generated_materials
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS generated_materials_stakeholder_select ON generated_materials;
CREATE POLICY generated_materials_stakeholder_select ON generated_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM stakeholders s
      WHERE s.id = generated_materials.stakeholder_id
        AND (
          s.profile_id = auth.uid()
          OR s.owner_user_id = auth.uid()
          OR (current_user_shell() = 'business' AND s.business_id = current_user_business_id())
          OR (
            current_user_shell() = 'community'
            AND EXISTS (
              SELECT 1
              FROM causes c
              WHERE c.id = s.cause_id
                AND (
                  c.owner_id = auth.uid()
                  OR c.organization_id = current_user_organization_id()
                )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS admin_tasks_admin_all ON admin_tasks;
CREATE POLICY admin_tasks_admin_all ON admin_tasks
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());
