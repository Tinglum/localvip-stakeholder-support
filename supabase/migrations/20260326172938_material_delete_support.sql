-- Support creator-owned material deletion and null out material references on delete.

DROP POLICY IF EXISTS materials_creator_insert ON materials;
CREATE POLICY materials_creator_insert ON materials
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS materials_creator_update ON materials;
CREATE POLICY materials_creator_update ON materials
  FOR UPDATE USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS materials_creator_delete ON materials;
CREATE POLICY materials_creator_delete ON materials
  FOR DELETE USING (created_by = auth.uid());

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_linked_material_id_fkey;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_linked_material_id_fkey
  FOREIGN KEY (linked_material_id) REFERENCES materials(id) ON DELETE SET NULL;

ALTER TABLE outreach_scripts DROP CONSTRAINT IF EXISTS outreach_scripts_linked_material_id_fkey;
ALTER TABLE outreach_scripts
  ADD CONSTRAINT outreach_scripts_linked_material_id_fkey
  FOREIGN KEY (linked_material_id) REFERENCES materials(id) ON DELETE SET NULL;
