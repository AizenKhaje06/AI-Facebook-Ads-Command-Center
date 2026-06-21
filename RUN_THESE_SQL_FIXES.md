# 🔧 SQL Fixes to Run in Supabase Dashboard

## ⚡ Quick Access
**Go to**: https://supabase.com/dashboard → Select Project → **SQL Editor** → **New Query**

---

## 🔥 RUN THESE 3 SQL SCRIPTS (In Order)

Copy each SQL block below, paste into SQL Editor, and click **"Run" ▶️**

---

### ✅ FIX 1: RLS Infinite Recursion (REQUIRED)

**Issue**: `infinite recursion detected in policy for relation "workspace_members"`

**Run this SQL:**

```sql
-- ============================================================================
-- FIX 1: Infinite Recursion in workspace_members RLS Policies
-- ============================================================================

-- Create helper function to avoid RLS recursion
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

-- Fix workspace_members policies
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

-- Fix workspaces policies
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
```

**Expected**: ✅ `Success. No rows returned`

---

### ✅ FIX 2: Backfill Missing Users (REQUIRED)

**Issue**: `violates foreign key constraint "workspaces_owner_id_fkey"`

**Run this SQL:**

```sql
-- ============================================================================
-- FIX 2: Backfill existing auth users to public.users table
-- ============================================================================

-- Insert existing auth users into public.users table
INSERT INTO public.users (id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    split_part(au.email, '@', 1)
  ) as full_name,
  au.raw_user_meta_data->>'avatar_url' as avatar_url,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL  -- Only insert users that don't exist yet
ON CONFLICT (id) DO NOTHING;  -- Skip if already exists
```

**Expected**: ✅ `Success. Rows: 1` (or however many users you have)

---

### ✅ FIX 3 (OPTIONAL): Verify Everything is Set Up

**Run this to check your setup:**

```sql
-- ============================================================================
-- VERIFICATION: Check if everything is set up correctly
-- ============================================================================

-- 1. Check if helper function exists
SELECT 
  'Helper Function' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM pg_proc 
WHERE proname = 'is_workspace_admin';

-- 2. Check if users are synced
SELECT 
  'Users Sync' as check_type,
  CASE 
    WHEN auth_count = users_count THEN '✅ SYNCED'
    ELSE '⚠️ MISMATCH'
  END as status,
  auth_count as auth_users,
  users_count as public_users
FROM (
  SELECT 
    (SELECT COUNT(*) FROM auth.users) as auth_count,
    (SELECT COUNT(*) FROM public.users) as users_count
) counts;

-- 3. Check RLS policies
SELECT 
  'RLS Policies' as check_type,
  COUNT(*) || ' policies' as status
FROM pg_policies 
WHERE tablename = 'workspace_members';

-- 4. List your auth users
SELECT 
  'Your Users' as info,
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- 5. Check if users are in public.users
SELECT 
  'Users in public.users' as info,
  id,
  email,
  full_name
FROM public.users
ORDER BY created_at DESC;
```

**Expected**: You should see matching numbers of users and existing policies

---

## 🎯 After Running All Fixes:

1. **Refresh your browser** (Ctrl+R or F5)
2. **Try creating a workspace** again
3. **Should work now!** ✅

---

## 🔍 Troubleshooting

### Still Getting Errors?

#### Error: "infinite recursion detected"
- ❌ You didn't run FIX 1
- ✅ Go back and run the RLS fix SQL

#### Error: "violates foreign key constraint"
- ❌ You didn't run FIX 2
- ✅ Go back and run the user backfill SQL

#### Error: "permission denied for table users"
- ❌ RLS is blocking the insert
- ✅ The function uses `SECURITY DEFINER` which should bypass this
- ✅ Make sure you're running as the Supabase admin

---

## 📝 What These Fixes Do:

### FIX 1: RLS Recursion
- Creates helper function that bypasses RLS
- Updates all workspace policies to use helper
- Breaks the circular dependency loop

### FIX 2: User Backfill
- Copies all `auth.users` to `public.users`
- Ensures every authenticated user has a profile
- Required for workspace foreign key constraint

### FIX 3: Verification (Optional)
- Checks if everything is configured correctly
- Shows user counts and policy status
- Helps diagnose any remaining issues

---

## ✅ Success Checklist

After running all fixes, you should be able to:

- [ ] Login to your app
- [ ] Create a workspace
- [ ] See workspace in dashboard
- [ ] Navigate to settings
- [ ] No more "infinite recursion" error
- [ ] No more "foreign key constraint" error

---

## 🚀 Next Steps

After database is fixed:

1. **Add Meta environment variables to Vercel**:
   - FACEBOOK_APP_ID
   - FACEBOOK_APP_SECRET
   - FACEBOOK_REDIRECT_URI
   - NEXT_PUBLIC_APP_URL

2. **Redeploy on Vercel**

3. **Connect Meta Account** and start syncing!

---

**Run these 3 SQL fixes NOW and your database will be ready!** 🔥
