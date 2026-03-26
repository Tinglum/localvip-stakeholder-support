-- Outreach activity analytics and QR/material integration fields

ALTER TABLE outreach_activities
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cause_id uuid REFERENCES causes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS script_category text,
  ADD COLUMN IF NOT EXISTS script_type text,
  ADD COLUMN IF NOT EXISTS script_tier outreach_script_tier,
  ADD COLUMN IF NOT EXISTS script_channel outreach_script_channel,
  ADD COLUMN IF NOT EXISTS outreach_status outreach_script_status,
  ADD COLUMN IF NOT EXISTS business_category text,
  ADD COLUMN IF NOT EXISTS generated_script_content text,
  ADD COLUMN IF NOT EXISTS edited_script_content text,
  ADD COLUMN IF NOT EXISTS log_notes text,
  ADD COLUMN IF NOT EXISTS linked_material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_qr_code_id uuid REFERENCES qr_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_qr_collection_id uuid REFERENCES qr_code_collections(id) ON DELETE SET NULL;

UPDATE outreach_activities
SET business_id = entity_id
WHERE entity_type = 'business'
  AND business_id IS NULL;

UPDATE outreach_activities AS activity
SET
  business_id = COALESCE(activity.business_id, script.business_id),
  cause_id = COALESCE(activity.cause_id, script.cause_id),
  city_id = COALESCE(activity.city_id, script.city_id),
  contact_id = COALESCE(activity.contact_id, script.contact_id),
  script_category = COALESCE(activity.script_category, script.script_category),
  script_type = COALESCE(activity.script_type, script.script_type),
  script_tier = COALESCE(activity.script_tier, script.script_tier),
  script_channel = COALESCE(activity.script_channel, script.channel),
  outreach_status = COALESCE(activity.outreach_status, script.status),
  business_category = COALESCE(activity.business_category, script.business_category),
  generated_script_content = COALESCE(activity.generated_script_content, script.generated_content),
  edited_script_content = COALESCE(activity.edited_script_content, script.final_content),
  linked_material_id = COALESCE(activity.linked_material_id, script.linked_material_id),
  linked_qr_code_id = COALESCE(activity.linked_qr_code_id, script.linked_qr_code_id),
  linked_qr_collection_id = COALESCE(activity.linked_qr_collection_id, script.linked_qr_collection_id)
FROM outreach_scripts AS script
WHERE activity.outreach_script_id = script.id;

CREATE INDEX IF NOT EXISTS idx_outreach_activities_business_created_at
  ON outreach_activities (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_activities_performed_by_created_at
  ON outreach_activities (performed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_activities_city_created_at
  ON outreach_activities (city_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_activities_campaign_created_at
  ON outreach_activities (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_activities_script_tier
  ON outreach_activities (script_tier);

CREATE INDEX IF NOT EXISTS idx_outreach_activities_outreach_status
  ON outreach_activities (outreach_status);
