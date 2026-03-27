-- Claimed stakeholder workflow for field users and launch partners

ALTER TABLE stakeholder_assignments
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_due_date timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE stakeholder_assignments
SET claimed_at = created_at
WHERE claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stakeholder_assignments_claimed_due
  ON stakeholder_assignments (stakeholder_id, entity_type, status, next_action_due_date);

CREATE INDEX IF NOT EXISTS idx_stakeholder_assignments_claimed_at
  ON stakeholder_assignments (entity_type, entity_id, claimed_at DESC);

CREATE OR REPLACE FUNCTION current_user_can_claim_entity(p_entity_type text, p_entity_id uuid)
RETURNS boolean AS $$
  SELECT CASE
    WHEN is_admin() THEN true
    WHEN current_user_shell() NOT IN ('field', 'launch_partner') THEN false
    WHEN p_entity_type = 'business' THEN EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = p_entity_id
        AND user_has_city_access(b.city_id)
    )
    WHEN p_entity_type = 'cause' THEN EXISTS (
      SELECT 1
      FROM causes c
      WHERE c.id = p_entity_id
        AND user_has_city_access(c.city_id)
    )
    ELSE false
  END
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_can_view_claimed_entity(p_entity_type text, p_entity_id uuid)
RETURNS boolean AS $$
  SELECT
    is_admin()
    OR EXISTS (
      SELECT 1
      FROM stakeholder_assignments sa
      WHERE sa.entity_type = p_entity_type
        AND sa.entity_id = p_entity_id
        AND sa.stakeholder_id = auth.uid()
        AND sa.status = 'active'
    )
    OR (
      current_user_shell() = 'launch_partner'
      AND current_user_can_claim_entity(p_entity_type, p_entity_id)
    )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS stakeholder_assignments_city_scope_select ON stakeholder_assignments;
CREATE POLICY stakeholder_assignments_city_scope_select ON stakeholder_assignments
  FOR SELECT USING (
    current_user_shell() = 'launch_partner'
    AND entity_type IN ('business', 'cause')
    AND current_user_can_claim_entity(entity_type, entity_id)
  );

DROP POLICY IF EXISTS stakeholder_assignments_self_claim_insert ON stakeholder_assignments;
CREATE POLICY stakeholder_assignments_self_claim_insert ON stakeholder_assignments
  FOR INSERT WITH CHECK (
    stakeholder_id = auth.uid()
    AND entity_type IN ('business', 'cause')
    AND current_user_can_claim_entity(entity_type, entity_id)
  );

DROP POLICY IF EXISTS stakeholder_assignments_self_claim_update ON stakeholder_assignments;
CREATE POLICY stakeholder_assignments_self_claim_update ON stakeholder_assignments
  FOR UPDATE USING (
    stakeholder_id = auth.uid()
    AND entity_type IN ('business', 'cause')
  )
  WITH CHECK (
    stakeholder_id = auth.uid()
    AND entity_type IN ('business', 'cause')
    AND current_user_can_claim_entity(entity_type, entity_id)
  );

DROP POLICY IF EXISTS stakeholder_assignments_self_claim_delete ON stakeholder_assignments;
CREATE POLICY stakeholder_assignments_self_claim_delete ON stakeholder_assignments
  FOR DELETE USING (
    stakeholder_id = auth.uid()
    AND entity_type IN ('business', 'cause')
  );

DROP POLICY IF EXISTS stakeholders_field_launch_select ON stakeholders;
CREATE POLICY stakeholders_field_launch_select ON stakeholders
  FOR SELECT USING (
    current_user_shell() IN ('field', 'launch_partner')
    AND (
      (business_id IS NOT NULL AND current_user_can_view_claimed_entity('business', business_id))
      OR (cause_id IS NOT NULL AND current_user_can_view_claimed_entity('cause', cause_id))
    )
  );

DROP POLICY IF EXISTS stakeholder_codes_field_launch_select ON stakeholder_codes;
CREATE POLICY stakeholder_codes_field_launch_select ON stakeholder_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM stakeholders s
      WHERE s.id = stakeholder_codes.stakeholder_id
        AND (
          (s.business_id IS NOT NULL AND current_user_can_view_claimed_entity('business', s.business_id))
          OR (s.cause_id IS NOT NULL AND current_user_can_view_claimed_entity('cause', s.cause_id))
        )
    )
  );

DROP POLICY IF EXISTS generated_materials_field_launch_select ON generated_materials;
CREATE POLICY generated_materials_field_launch_select ON generated_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM stakeholders s
      WHERE s.id = generated_materials.stakeholder_id
        AND (
          (s.business_id IS NOT NULL AND current_user_can_view_claimed_entity('business', s.business_id))
          OR (s.cause_id IS NOT NULL AND current_user_can_view_claimed_entity('cause', s.cause_id))
        )
    )
  );
