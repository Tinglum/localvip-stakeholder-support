ALTER TABLE stakeholder_codes
  ALTER COLUMN referral_code DROP NOT NULL,
  ALTER COLUMN connection_code DROP NOT NULL,
  ALTER COLUMN join_url DROP NOT NULL;

DROP INDEX IF EXISTS idx_stakeholder_codes_referral_code_unique;
DROP INDEX IF EXISTS idx_stakeholder_codes_connection_code_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholder_codes_referral_code_unique
  ON stakeholder_codes (lower(referral_code))
  WHERE referral_code IS NOT NULL AND btrim(referral_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholder_codes_connection_code_unique
  ON stakeholder_codes (lower(connection_code))
  WHERE connection_code IS NOT NULL AND btrim(connection_code) <> '';

ALTER TABLE stakeholder_codes
  DROP CONSTRAINT IF EXISTS stakeholder_codes_referral_or_connection_check;

ALTER TABLE stakeholder_codes
  ADD CONSTRAINT stakeholder_codes_referral_or_connection_check
  CHECK (
    referral_code IS NULL
    OR connection_code IS NULL
    OR join_url IS NULL
    OR (
      btrim(referral_code) <> ''
      AND btrim(connection_code) <> ''
      AND btrim(join_url) <> ''
    )
  );

ALTER TABLE qr_code_collections
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE stakeholder_assignments
  ADD COLUMN IF NOT EXISTS ownership_status text NOT NULL DEFAULT 'supporting';

ALTER TABLE stakeholder_assignments
  DROP CONSTRAINT IF EXISTS stakeholder_assignments_ownership_status_check;

ALTER TABLE stakeholder_assignments
  ADD CONSTRAINT stakeholder_assignments_ownership_status_check
  CHECK (ownership_status IN ('active_owner', 'supporting', 'released'));

WITH ranked_assignments AS (
  SELECT
    id,
    entity_type,
    entity_id,
    status,
    role,
    row_number() OVER (
      PARTITION BY entity_type, entity_id
      ORDER BY
        CASE WHEN role = 'claim_owner' THEN 0 ELSE 1 END,
        COALESCE(claimed_at, created_at) DESC,
        created_at DESC
    ) AS owner_rank
  FROM stakeholder_assignments
  WHERE status = 'active'
)
UPDATE stakeholder_assignments sa
SET ownership_status = CASE
  WHEN ranked_assignments.owner_rank = 1 AND COALESCE(sa.role, '') = 'claim_owner' THEN 'active_owner'
  WHEN ranked_assignments.owner_rank = 1 AND COALESCE(sa.role, '') <> 'claim_owner' THEN 'supporting'
  ELSE 'supporting'
END
FROM ranked_assignments
WHERE ranked_assignments.id = sa.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholder_assignments_one_active_owner
  ON stakeholder_assignments (entity_type, entity_id)
  WHERE status = 'active' AND ownership_status = 'active_owner';

UPDATE stakeholder_assignments
SET ownership_status = 'active_owner'
WHERE COALESCE(role, '') = 'claim_owner'
  AND status = 'active'
  AND id IN (
    SELECT id
    FROM (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY entity_type, entity_id
          ORDER BY COALESCE(claimed_at, created_at) DESC, created_at DESC
        ) AS ranked_owner
      FROM stakeholder_assignments
      WHERE COALESCE(role, '') = 'claim_owner'
        AND status = 'active'
    ) ranked
    WHERE ranked_owner = 1
  );

UPDATE stakeholder_assignments
SET ownership_status = 'supporting'
WHERE COALESCE(role, '') <> 'claim_owner'
  AND ownership_status <> 'released';

ALTER TABLE business_referrals
  DROP CONSTRAINT IF EXISTS business_referrals_status_check;

UPDATE business_referrals
SET status = CASE status
  WHEN 'draft' THEN 'not_contacted'
  WHEN 'sent' THEN 'contacted'
  WHEN 'responded' THEN 'responded'
  WHEN 'converted' THEN 'onboarded'
  WHEN 'closed' THEN 'contacted'
  ELSE 'contacted'
END;

ALTER TABLE business_referrals
  ADD CONSTRAINT business_referrals_status_check
  CHECK (status IN ('not_contacted', 'contacted', 'responded', 'interested', 'onboarded'));
