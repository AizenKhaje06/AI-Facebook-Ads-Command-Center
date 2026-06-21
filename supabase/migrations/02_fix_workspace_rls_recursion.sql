-- ============================================================================
-- FIX: Infinite Recursion in workspace_members RLS Policies
-- ============================================================================
-- This migration fixes the circular dependency in RLS policies that caused
-- "infinite recursion detected in policy for relation 'workspace_members'" error
-- ============================================================================

-- Helper function to check if user is workspace admin (avoids circular RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_admin(workspace_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = workspace_uuid 
    AND user_id = user_uuid 
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Fix workspace_members RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "select_own_memberships" ON public.workspace_members;
CREATE POLICY "select_own_memberships" ON public.workspace_members FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR is_workspace_admin(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS "insert_member_as_admin" ON public.workspace_members;
CREATE POLICY "insert_member_as_admin" ON public.workspace_members FOR INSERT
  TO authenticated WITH CHECK (
    is_workspace_admin(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS "update_member_as_admin" ON public.workspace_members;
CREATE POLICY "update_member_as_admin" ON public.workspace_members FOR UPDATE
  TO authenticated USING (
    is_workspace_admin(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS "delete_member_as_admin" ON public.workspace_members;
CREATE POLICY "delete_member_as_admin" ON public.workspace_members FOR DELETE
  TO authenticated USING (
    is_workspace_admin(workspace_id, auth.uid())
    OR user_id = auth.uid()
  );

-- ============================================================================
-- Fix workspaces RLS policies  
-- ============================================================================

DROP POLICY IF EXISTS "select_workspace_as_member" ON public.workspaces;
CREATE POLICY "select_workspace_as_member" ON public.workspaces FOR SELECT
  TO authenticated USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members 
      WHERE workspace_id = workspaces.id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_workspace_as_admin" ON public.workspaces;
CREATE POLICY "update_workspace_as_admin" ON public.workspaces FOR UPDATE
  TO authenticated USING (
    is_workspace_admin(id, auth.uid())
  );
