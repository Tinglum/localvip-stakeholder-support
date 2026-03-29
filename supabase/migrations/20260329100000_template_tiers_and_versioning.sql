-- Template tiers and versioning for material engine

-- Add tier system: auto (generated on creation), assignable (admin pushes), selfserve (business picks)
ALTER TABLE material_templates
  ADD COLUMN IF NOT EXISTS tiers text[] NOT NULL DEFAULT '{auto}'::text[],
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS scope_global boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scope_cities uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS scope_campaigns uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS scope_categories text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN material_templates.tiers IS 'Template availability tiers: auto, assignable, selfserve';
COMMENT ON COLUMN material_templates.version IS 'Incremented when template content changes';
COMMENT ON COLUMN material_templates.scope_global IS 'If true, template applies to all entities regardless of scope arrays';
COMMENT ON COLUMN material_templates.scope_cities IS 'Limit auto-generation to these city IDs (empty = all when scope_global)';
COMMENT ON COLUMN material_templates.scope_campaigns IS 'Limit auto-generation to these campaign IDs (empty = all when scope_global)';
COMMENT ON COLUMN material_templates.scope_categories IS 'Limit auto-generation to these business categories (empty = all when scope_global)';

-- Track which template version was used for each generated material
ALTER TABLE generated_materials
  ADD COLUMN IF NOT EXISTS template_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_outdated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_accepted boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN generated_materials.template_version IS 'Version of template used to generate this material';
COMMENT ON COLUMN generated_materials.is_outdated IS 'True when template has been updated since generation';
COMMENT ON COLUMN generated_materials.user_accepted IS 'True if the stakeholder accepted this material into their library';

-- Function to mark generated materials as outdated when template version changes
CREATE OR REPLACE FUNCTION mark_generated_materials_outdated()
RETURNS trigger AS $$
BEGIN
  IF OLD.version IS DISTINCT FROM NEW.version THEN
    UPDATE generated_materials
    SET is_outdated = true
    WHERE template_id = NEW.id
      AND template_version < NEW.version
      AND generation_status = 'generated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mark_generated_materials_outdated_trigger ON material_templates;
CREATE TRIGGER mark_generated_materials_outdated_trigger
  AFTER UPDATE ON material_templates
  FOR EACH ROW EXECUTE FUNCTION mark_generated_materials_outdated();

-- Allow stakeholders to read material_templates marked as selfserve
DROP POLICY IF EXISTS material_templates_selfserve_select ON material_templates;
CREATE POLICY material_templates_selfserve_select ON material_templates
  FOR SELECT USING (
    is_active = true
    AND 'selfserve' = ANY(tiers)
  );

-- Index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_material_templates_tiers
  ON material_templates USING GIN (tiers);

CREATE INDEX IF NOT EXISTS idx_generated_materials_outdated
  ON generated_materials (is_outdated)
  WHERE is_outdated = true;
