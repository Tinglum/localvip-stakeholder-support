-- Fix is_admin() to recognize the 'admin' role in addition to
-- 'super_admin' and 'internal_admin'. QA-provisioned users get
-- role='admin' which was previously excluded from RLS admin policies.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'internal_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
