-- ============================================================
-- Migration: Add RLS policies for community shell users on
--   stakeholder_codes and qr_codes tables
-- Date: 2026-04-05
--
-- Problem: Cause leaders (community shell) can see their stakeholder
-- and generated materials but NOT their codes or QR codes because
-- no SELECT policy existed for the community shell on these tables.
-- ============================================================

-- 1. stakeholder_codes: allow community users to read codes for
--    stakeholders linked to causes they own or belong to via org
DROP POLICY IF EXISTS stakeholder_codes_community_select ON stakeholder_codes;
CREATE POLICY stakeholder_codes_community_select ON stakeholder_codes
  FOR SELECT USING (
    current_user_shell() = 'community'
    AND EXISTS (
      SELECT 1
      FROM stakeholders s
        JOIN causes c ON c.id = s.cause_id
      WHERE s.id = stakeholder_codes.stakeholder_id
        AND (
          c.owner_id = auth.uid()
          OR c.organization_id = current_user_organization_id()
        )
    )
  );

-- 2. qr_codes: allow community users to read QR codes linked to
--    causes they own or belong to via org
DROP POLICY IF EXISTS qr_codes_community_select ON qr_codes;
CREATE POLICY qr_codes_community_select ON qr_codes
  FOR SELECT USING (
    current_user_shell() = 'community'
    AND cause_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM causes c
      WHERE c.id = qr_codes.cause_id
        AND (
          c.owner_id = auth.uid()
          OR c.organization_id = current_user_organization_id()
        )
    )
  );
