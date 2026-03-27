ALTER TABLE business_referrals
  ADD COLUMN IF NOT EXISTS target_business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

UPDATE business_referrals
SET target_business_id = converted_business_id
WHERE target_business_id IS NULL
  AND converted_business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_referrals_target_business_id
  ON business_referrals (target_business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_referrals_target_contact_id
  ON business_referrals (target_contact_id, created_at DESC);
