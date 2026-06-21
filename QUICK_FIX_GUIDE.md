# 🚀 Quick Fix Guide - Get Your App Running

## 🔴 Current Issues

### 1. **Workspace Creation Error** (CRITICAL)
**Error**: "infinite recursion detected in policy for relation 'workspace_members'"

**Status**: ❌ **NOT FIXED YET - ACTION REQUIRED!**

### 2. **Connect Account Settings Missing**
**Status**: ✅ **FIXED** - Now links to workspace settings

---

## ⚡ STEP 1: Fix Database RLS (DO THIS FIRST!)

The app won't work until you apply this database fix. This is **MANDATORY**.

### Option A: Supabase Dashboard (Recommended - 2 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Login and select your project

2. **Open SQL Editor**
   - Click **"SQL Editor"** in left sidebar
   - Click **"New query"** button

3. **Run the Fix**
   - Copy ALL the SQL below
   - Paste into SQL Editor
   - Click **"Run" ▶️** button
   - Wait for "Success. No rows returned"

```sql
-- ============================================================================
-- FIX: Infinite Recursion in workspace_members RLS Policies
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

4. **Verify Success**
   - You should see: ✅ "Success. No rows returned"
   - If you see errors, copy them and let me know

### Option B: Supabase CLI

```bash
cd "C:\Users\Administrator\Documents\GITHUB PROJECTS\AI-Facebook-Ads-Command-Center"
npx supabase db push
```

---

## ✅ STEP 2: Test Workspace Creation

After applying the database fix:

1. **Refresh Your App**
   - Press `Ctrl+R` or `F5` in your browser
   - Or close and reopen the browser tab

2. **Try Creating a Workspace**
   - Go to: http://localhost:3000/workspaces/new
   - Enter workspace name: "My Ads Manager"
   - Click **"Create workspace"**

3. **Expected Result**: ✅
   - Should redirect to dashboard
   - No more "infinite recursion" error!
   - Workspace shows in sidebar

---

## 📱 STEP 3: Connect Meta Account

Now that workspace is working:

### From Dashboard:
1. Click **"Connect Account"** button in "Connected Accounts" section
2. This will take you to **Workspace Settings**

### From Settings:
1. Click **"Settings"** in sidebar
2. Click **"Workspace"** tab
3. Look for **"Meta Connections"** section
4. Click **"Connect Facebook Business Manager"**

### Connection Process:
1. Login to Facebook
2. Select Business Manager
3. Grant permissions:
   - ✅ ads_read
   - ✅ ads_management  
   - ✅ business_management
   - ✅ pages_read_engagement
4. Select Ad Accounts to sync
5. Click **"Continue"**

---

## 🎯 STEP 4: Sync Data

After connecting:

1. **Go to Ad Accounts page** (`/ad-accounts`)
2. **Select your connected account** from the list
3. **Click "Sync All"** button
4. **Wait for sync to complete** (may take 1-2 minutes)
5. **Check Sync History** to see results

### What Gets Synced:
- ✅ Ad Accounts
- ✅ Campaigns
- ✅ Ad Sets
- ✅ Ads
- ✅ Insights (last 30 days)

---

## 🐛 Troubleshooting

### Issue: Still Getting "infinite recursion" Error

**Cause**: Database fix not applied

**Solution**:
1. Go back to STEP 1
2. Make sure SQL ran successfully in Supabase
3. Check Supabase logs: Dashboard → Logs → Database
4. Look for any policy errors

### Issue: Can't See "Connect Account" Button

**Cause**: Not a workspace admin/owner

**Solution**:
- Only workspace owners and admins can connect accounts
- Check your role in workspace settings
- Ask workspace owner to grant you admin access

### Issue: Facebook OAuth Error

**Cause**: Missing or invalid environment variables

**Solution**:
1. Check `.env.local` has these values:
   ```
   NEXT_PUBLIC_META_APP_ID=your_app_id
   META_APP_SECRET=your_app_secret
   NEXT_PUBLIC_META_REDIRECT_URI=http://localhost:3000/api/meta/callback
   ```

2. Verify Meta App settings:
   - Go to: https://developers.facebook.com/apps
   - Select your app
   - Add redirect URI: `http://localhost:3000/api/meta/callback`

### Issue: Sync Fails with "Token Invalid"

**Cause**: Access token expired

**Solution**:
1. Go to Ad Accounts page
2. Click connection name
3. Scroll to bottom
4. Click **"Disconnect this account"**
5. Reconnect the account (gets fresh token)

### Issue: No Data After Sync

**Cause**: May be filtering or no recent data

**Solution**:
1. Check sync history for errors
2. Verify ad accounts have active campaigns
3. Try manual sync for specific entity:
   - Click "Campaigns" button
   - Click "Ad Sets" button
   - Click "Insights" button

---

## 📊 What Should Work Now

After completing all steps:

### ✅ Dashboard
- View total spend, impressions, clicks, conversions
- See connected accounts
- Quick actions (sync, view analytics, etc.)

### ✅ Campaigns
- View all campaigns across accounts
- Filter by status, objective, date range
- Sort by performance metrics
- Bulk actions (pause, activate)

### ✅ Ad Sets & Ads
- Browse hierarchical structure
- View detailed metrics
- Edit settings (budget, targeting, etc.)

### ✅ Analytics
- Performance charts (spend, ROAS, CPA)
- Breakdown by campaign, ad set, or ad
- Date range selection
- Export data

### ✅ Insights
- AI-powered recommendations
- Anomaly detection
- Budget optimization suggestions
- Creative fatigue warnings

### ✅ Alerts
- Automatic alerts for issues:
  - ROAS drops
  - CPA spikes
  - High frequency (creative fatigue)
  - Spend anomalies
- Email notifications (if configured)

### ✅ Reports
- Generate custom reports
- Export as CSV, Excel, or PDF
- Share via secure links
- Schedule automated reports

---

## 🎉 Success Checklist

Mark these off as you complete them:

- [ ] ✅ Applied database RLS fix in Supabase
- [ ] ✅ Created first workspace successfully
- [ ] ✅ Connected Facebook Business Manager
- [ ] ✅ Synced ad accounts and campaigns
- [ ] ✅ Viewing data in dashboard
- [ ] ✅ Campaigns page showing data
- [ ] ✅ Analytics charts displaying
- [ ] ✅ Received first AI insight/alert

---

## 🆘 Still Need Help?

### Check Logs:

**Browser Console:**
1. Press `F12` to open DevTools
2. Click **"Console"** tab
3. Look for red errors
4. Copy error messages

**Supabase Logs:**
1. Dashboard → Logs
2. Select "Database" or "API"
3. Look for failed queries
4. Check RLS policy errors

**Server Logs:**
1. Open terminal where app is running
2. Look for error messages
3. Check API route errors

### Common Error Codes:

- **42P17**: Infinite recursion (RLS fix needed)
- **401**: Authentication issue (check Supabase keys)
- **403**: Permission denied (RLS policy issue)
- **500**: Server error (check .env variables)

---

## 📚 Additional Resources

- **Full Setup Guide**: `PRODUCTION_SETUP.md`
- **Meta Connection Guide**: `META_CONNECTION_GUIDE.md`
- **Supabase RLS Fix**: `SUPABASE_FIX_GUIDE.md`
- **API Documentation**: `API_DOCUMENTATION.md`
- **Deployment Guide**: `DEPLOYMENT.md`

---

## 🚀 Next Steps After Setup

1. **Invite Team Members**
   - Go to Settings → Workspace
   - Click "Invite Member"
   - Set role (Owner, Admin, Member, Viewer)

2. **Configure Alerts**
   - Go to Alerts page
   - Set up notification preferences
   - Configure alert thresholds

3. **Create Custom Views**
   - Go to Campaigns page
   - Customize columns and filters
   - Save as custom view

4. **Schedule Reports**
   - Go to Reports page
   - Create report template
   - Set schedule (daily, weekly)

5. **Deploy to Production**
   - Follow `DEPLOYMENT.md` guide
   - Deploy to Vercel
   - Set up Bull workers separately
   - Configure production environment variables

---

**Remember**: The database RLS fix (STEP 1) is **MANDATORY** - nothing will work without it! 🔥
