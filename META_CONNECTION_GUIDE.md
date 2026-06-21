# Meta Business Ads Connection Guide

This guide walks you through connecting your Meta (Facebook) Business Ads account to AdPilot AI.

## Prerequisites

Before you begin, make sure you have:

1. **A Meta Business Manager account** - Create one at [business.facebook.com](https://business.facebook.com)
2. **An active Facebook Ad Account** - Linked to your Business Manager
3. **Admin access** to the Business Manager (required to grant permissions)
4. **Meta App credentials** configured in your AdPilot instance

---

## Step 1: Log in to AdPilot

1. Go to your AdPilot dashboard
2. Log in with your email and password
3. You will be redirected to the main dashboard

---

## Step 2: Navigate to Ad Accounts

1. In the left sidebar, click **"Ad Accounts"**
2. You will see a screen showing "No Meta accounts connected"
3. You'll also see a message: *"Connect your Facebook Business Manager from the workspace settings"*

---

## Step 3: Access Workspace Settings

1. Click **"Settings"** in the left sidebar
2. Click **"Workspace"** from the settings menu
3. Alternatively, go directly to `/settings/workspace`

> **Note:** You must be an **Owner** or **Admin** of the workspace to manage connections.

---

## Step 4: Initiate Meta Connection

From the Workspace Settings page:

1. Look for the **"Meta Integration"** or **"Connect Meta"** section
2. Click the **"Connect Meta Account"** button
3. A popup window will open for Facebook OAuth authorization

---

## Step 5: Authorize with Facebook

In the Facebook popup window:

1. **Log in** to your Facebook account (if not already logged in)
2. **Select your Business Manager** from the list
3. Facebook will show a permission request screen

### Required Permissions

AdPilot requests the following permissions:

| Permission | Purpose |
|------------|---------|
| `email` | Identify your account |
| `public_profile` | Basic profile information |
| `business_management` | Access Business Manager |
| `ads_management` | Create/edit campaigns |
| `ads_read` | Read campaign data and insights |

4. Click **"Continue"** or **"Allow"** to grant permissions
5. Select which **Ad Accounts** to connect
6. Click **"OK"** to complete authorization

---

## Step 6: Connection Confirmation

After successful authorization:

1. The popup window will show **"Connected!"**
2. The window will close automatically
3. Your AdPilot dashboard will refresh
4. You'll see your connected Meta account in the list

---

## Step 7: Sync Your Data

Once connected, you need to sync your data:

1. Go to **Ad Accounts** page
2. Click on your newly connected account
3. Click **"Sync All"** to import:
   - Campaigns
   - Ad Sets
   - Ads
   - Insights (performance data)

### Sync Options

| Button | What it Syncs |
|--------|---------------|
| **Campaigns** | All campaigns from connected ad accounts |
| **Ad Sets** | Ad sets for each campaign |
| **Insights** | Performance metrics (impressions, clicks, spend, ROAS) |
| **Sync All** | Everything above |

> **Important:** First sync may take several minutes depending on data volume. Insights are synced for the last 30 days by default.

---

## Step 8: Verify Connection

To verify your connection is working:

1. Go to **Dashboard** - You should see campaign metrics
2. Go to **Campaigns** - Your campaigns should be listed
3. Go to **Analytics** - Performance charts should display data

---

## Troubleshooting

### "Unsupported provider" Error

This means Google/Facebook OAuth is not enabled in Supabase:
- Solution: Contact your administrator or use email/password login

### "Connection Failed" Error

Common causes:

| Issue | Solution |
|-------|----------|
| Token expired | Click "Reconnect" in Ad Accounts page |
| Permission denied | Re-authorize with proper permissions |
| Invalid credentials | Check Meta App configuration |

### "No data showing" after sync

1. Wait for sync to complete (check Sync History)
2. Ensure your ad account has active campaigns
3. Try a manual sync with "Sync All"

### Token Expiration

Meta tokens expire after ~60 days. AdPilot automatically refreshes tokens weekly via cron job. If a token expires:

1. Go to Ad Accounts
2. Click "Reconnect" on the connection
3. Re-authorize with Facebook

---

## Disconnect Your Account

To disconnect a Meta account:

1. Go to **Ad Accounts**
2. Click on the connected account
3. Click **"Disconnect this account"**
4. Confirm the disconnection

> **Warning:** Disconnecting removes all synced data associated with that connection.

---

## Managing Multiple Ad Accounts

You can connect multiple Meta accounts:

1. Each Facebook user profile can be connected separately
2. Each connection syncs independently
3. Data from all connections appears in unified dashboards

---

## API Overview for Developers

### OAuth Flow

```
User                AdPilot              Meta OAuth           Edge Function
  │                    │                     │                    │
  │───Click Connect───│                     │                    │
  │                    │───GET /api/meta/connect─────────────────↘
  │                    │                     │   ← authorize URL
  │                    │←────────────────────│                    │
  │←── Open popup ─────│                     │                    │
  │                    │                     │                    │
  │──────────── Authorize with Facebook ─────────────────────→  │
  │                    │                     │                    │
  │                    │    /meta/callback?code=XXX              │
  │                    │←────────────────────│                    │
  │                    │─POST code to edge fn────────────────────→│
  │                    │                     │   exchange token  │
  │                    │                     │←──────────────────│
  │                    │                     │   store encrypted │
  │                    │←─────────────────────────────────────────│
  │←── Success ────────│                     │                    │
```

### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/meta/connect` | Get OAuth authorization URL |
| `GET /meta/callback` | Handle OAuth callback |
| `POST /api/meta/sync` | Trigger data sync |
| `GET /api/meta/status` | Check connection status |
| `DELETE /api/meta/connections/[id]` | Disconnect account |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `meta-oauth` | Handle OAuth flow and token exchange |
| `meta-refresh` | Refresh expired tokens |
| `meta-sync` | Sync campaigns, ad sets, ads, insights |

---

## Security

- All tokens are encrypted using **AES-256-GCM** before storage
- Tokens are stored in Supabase with Row-Level Security
- Only workspace members can access their workspace's connections
- Tokens auto-refresh weekly via pg_cron job

---

## Support

If you encounter issues:

1. Check the **Sync History** in Ad Accounts page
2. Review browser console for errors
3. Verify your Meta Business Manager permissions
4. Contact support with the error details
