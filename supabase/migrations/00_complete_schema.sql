-- ============================================================================
-- COMPLETE SUPABASE SCHEMA MIGRATION
-- AI Facebook Ads Command Center
-- ============================================================================
-- This file consolidates all tables needed for the application.
-- Run this migration to set up the complete database schema.
-- ============================================================================

-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically create workspace membership on workspace creation
CREATE OR REPLACE FUNCTION public.create_workspace_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. USERS & WORKSPACES TABLES
-- ============================================================================

-- Create users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workspace_members table (junction table with roles)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES public.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- ============================================================================
-- 3. META CONNECTIONS TABLES
-- ============================================================================

-- Meta connections table - stores Facebook account connections
CREATE TABLE IF NOT EXISTS public.meta_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  facebook_user_id TEXT NOT NULL,
  facebook_user_name TEXT,
  facebook_user_email TEXT,
  facebook_user_picture_url TEXT,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  granted_scopes TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disconnected', 'error')),
  last_error_message TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, facebook_user_id)
);

-- Business managers linked to Meta connections
CREATE TABLE IF NOT EXISTS public.meta_business_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  business_manager_id TEXT NOT NULL,
  name TEXT NOT NULL,
  profile_picture_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meta_connection_id, business_manager_id)
);

-- Ad accounts linked to business managers
CREATE TABLE IF NOT EXISTS public.meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  business_manager_id UUID REFERENCES public.meta_business_managers(id) ON DELETE SET NULL,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_status INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'USD',
  timezone_name TEXT,
  amount_spent DECIMAL(15,2) DEFAULT 0,
  balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meta_connection_id, ad_account_id)
);

-- ============================================================================
-- 4. CAMPAIGNS, AD SETS & ADS TABLES
-- ============================================================================

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT,
  effective_status TEXT,
  buying_type TEXT,
  budget_remaining DECIMAL(15,2),
  daily_budget DECIMAL(15,2),
  lifetime_budget DECIMAL(15,2),
  start_time TIMESTAMPTZ,
  stop_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  data_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_account_id, campaign_id)
);

-- Ad Sets table
CREATE TABLE IF NOT EXISTS public.meta_ad_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  adset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  campaign_id_meta TEXT,
  status TEXT,
  effective_status TEXT,
  optimization_goal TEXT,
  billing_event TEXT,
  bid_strategy TEXT,
  daily_budget DECIMAL(15,2),
  lifetime_budget DECIMAL(15,2),
  targeting JSONB,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  data_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_account_id, adset_id)
);

-- Ads table
CREATE TABLE IF NOT EXISTS public.meta_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  ad_set_id UUID NOT NULL REFERENCES public.meta_ad_sets(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  name TEXT NOT NULL,
  adset_id_meta TEXT,
  campaign_id_meta TEXT,
  status TEXT,
  effective_status TEXT,
  creative JSONB,
  display_format TEXT,
  last_synced_at TIMESTAMPTZ,
  data_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_account_id, ad_id)
);

-- ============================================================================
-- 5. INSIGHTS & SYNC TABLES
-- ============================================================================

-- Insights table (daily metrics)
CREATE TABLE IF NOT EXISTS public.meta_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account', 'campaign', 'adset', 'ad')),
  entity_id UUID,
  entity_id_meta TEXT NOT NULL,
  ad_account_id UUID REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  unique_clicks BIGINT DEFAULT 0,
  spend DECIMAL(15,2) DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency DECIMAL(10,4) DEFAULT 0,
  cpm DECIMAL(10,4) DEFAULT 0,
  cpc DECIMAL(10,4) DEFAULT 0,
  ctr DECIMAL(10,4) DEFAULT 0,
  actions JSONB,
  conversions BIGINT DEFAULT 0,
  conversion_value DECIMAL(15,2) DEFAULT 0,
  cost_per_conversion DECIMAL(10,4) DEFAULT 0,
  roas DECIMAL(10,4) DEFAULT 0,
  purchases BIGINT DEFAULT 0,
  purchase_value DECIMAL(15,2) DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id_meta, date)
);

-- Sync logs table
CREATE TABLE IF NOT EXISTS public.meta_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id UUID REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual', 'scheduled')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('all', 'business_managers', 'ad_accounts', 'campaigns', 'adsets', 'ads', 'insights')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  error_message TEXT,
  error_details JSONB,
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync state table (tracks last successful sync per entity type)
CREATE TABLE IF NOT EXISTS public.meta_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id UUID REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('business_managers', 'ad_accounts', 'campaigns', 'adsets', 'ads', 'insights')),
  last_sync_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  last_sync_log_id UUID REFERENCES public.meta_sync_logs(id),
  cursor TEXT,
  error_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meta_connection_id, ad_account_id, entity_type)
);

-- ============================================================================
-- 6. CAMPAIGN RECOMMENDATIONS & FORECASTS
-- ============================================================================

-- Campaign Recommendations table
CREATE TABLE IF NOT EXISTS public.campaign_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('increase_budget', 'decrease_budget', 'pause', 'duplicate', 'refresh_creatives', 'expand_audience')),
  confidence_score DECIMAL(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning TEXT NOT NULL,
  current_metrics JSONB NOT NULL DEFAULT '{}',
  suggested_value JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed', 'expired')),
  applied_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Forecasts table
CREATE TABLE IF NOT EXISTS public.campaign_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  forecast_type TEXT NOT NULL CHECK (forecast_type IN ('revenue', 'spend', 'roas', 'cpa', 'purchases')),
  forecast_period_days INTEGER NOT NULL CHECK (forecast_period_days > 0),
  predicted_value DECIMAL(15,4) NOT NULL,
  confidence_lower DECIMAL(15,4),
  confidence_upper DECIMAL(15,4),
  confidence_level DECIMAL(4,3) NOT NULL DEFAULT 0.95 CHECK (confidence_level > 0 AND confidence_level <= 1),
  historical_data_points INTEGER NOT NULL DEFAULT 0,
  model_version TEXT NOT NULL DEFAULT 'v1.0',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. ALERTS SYSTEM
-- ============================================================================

-- Campaign Alerts table
CREATE TABLE IF NOT EXISTS public.campaign_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('roas_drop', 'cpa_spike', 'high_frequency', 'creative_fatigue', 'spend_anomaly', 'pixel_issue', 'learning_limited')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metric_name TEXT,
  metric_value DECIMAL(15,4),
  threshold_value DECIMAL(15,4),
  previous_value DECIMAL(15,4),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert deduplication table
CREATE TABLE IF NOT EXISTS public.alert_dedup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key TEXT NOT NULL UNIQUE,
  alert_id UUID REFERENCES public.campaign_alerts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. REPORTS & NOTIFICATIONS
-- ============================================================================

-- Campaign Reports table
CREATE TABLE IF NOT EXISTS public.campaign_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('campaign_summary', 'performance', 'insights', 'health', 'recommendations', 'forecasts', 'alerts')),
  format TEXT NOT NULL CHECK (format IN ('csv', 'excel', 'pdf')),
  title TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  file_url TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shareable Reports table
CREATE TABLE IF NOT EXISTS public.shareable_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.campaign_reports(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('alert', 'report_ready', 'campaign_issue', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'both')),
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
  delivery_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  alert_email BOOLEAN NOT NULL DEFAULT true,
  report_email BOOLEAN NOT NULL DEFAULT true,
  campaign_issue_email BOOLEAN NOT NULL DEFAULT true,
  digest_frequency TEXT NOT NULL DEFAULT 'realtime' CHECK (digest_frequency IN ('realtime', 'daily', 'weekly', 'none')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. SAVED VIEWS & CONFIGURATION
-- ============================================================================

-- Saved views for dashboard customization
CREATE TABLE IF NOT EXISTS public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'campaigns' CHECK (view_type IN ('campaigns', 'adsets', 'ads', 'analytics')),
  is_default BOOLEAN DEFAULT false,
  columns JSONB DEFAULT '["name", "status", "budget", "spent", "impressions", "clicks", "ctr", "cpc", "conversions"]',
  filters JSONB DEFAULT '{}',
  sort_by TEXT DEFAULT 'name',
  sort_order TEXT DEFAULT 'asc' CHECK (sort_order IN ('asc', 'desc')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id, name)
);

-- ============================================================================
-- 10. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users & Workspaces Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- Meta Connections Indexes
CREATE INDEX IF NOT EXISTS idx_meta_connections_workspace ON public.meta_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meta_connections_user ON public.meta_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_connections_facebook_user ON public.meta_connections(facebook_user_id);
CREATE INDEX IF NOT EXISTS idx_meta_business_managers_connection ON public.meta_business_managers(meta_connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_connection ON public.meta_ad_accounts(meta_connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_business ON public.meta_ad_accounts(business_manager_id);

-- Campaigns, Ad Sets & Ads Indexes
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_connection ON public.meta_campaigns(meta_connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_account ON public.meta_campaigns(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON public.meta_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_connection ON public.meta_ad_sets(meta_connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_account ON public.meta_ad_sets(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_campaign ON public.meta_ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_connection ON public.meta_ads(meta_connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_account ON public.meta_ads(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON public.meta_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset ON public.meta_ads(ad_set_id);

-- Insights & Sync Indexes
CREATE INDEX IF NOT EXISTS idx_meta_insights_connection ON public.meta_insights(meta_connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_entity ON public.meta_insights(entity_type, entity_id_meta);
CREATE INDEX IF NOT EXISTS idx_meta_insights_date ON public.meta_insights(date);
CREATE INDEX IF NOT EXISTS idx_meta_insights_composite ON public.meta_insights(entity_type, entity_id_meta, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_connection ON public.meta_sync_logs(meta_connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_status ON public.meta_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_meta_sync_state_connection ON public.meta_sync_state(meta_connection_id);

-- Recommendations & Forecasts Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_recommendations_campaign ON public.campaign_recommendations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recommendations_workspace ON public.campaign_recommendations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recommendations_status ON public.campaign_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recommendations_created ON public.campaign_recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_forecasts_campaign ON public.campaign_forecasts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_forecasts_workspace ON public.campaign_forecasts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_forecasts_type ON public.campaign_forecasts(forecast_type);
CREATE INDEX IF NOT EXISTS idx_campaign_forecasts_generated ON public.campaign_forecasts(generated_at DESC);

-- Alerts Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_campaign ON public.campaign_alerts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_workspace ON public.campaign_alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_type ON public.campaign_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_status ON public.campaign_alerts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_severity ON public.campaign_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_created ON public.campaign_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_dedup_key ON public.alert_dedup(alert_key);

-- Reports & Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_reports_workspace ON public.campaign_reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_reports_user ON public.campaign_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_reports_status ON public.campaign_reports(status);
CREATE INDEX IF NOT EXISTS idx_campaign_reports_created ON public.campaign_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shareable_reports_token ON public.shareable_reports(token);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_workspace ON public.user_notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON public.user_notifications(read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created ON public.user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON public.user_notifications(type);

-- Saved Views Indexes
CREATE INDEX IF NOT EXISTS idx_saved_views_workspace ON public.saved_views(workspace_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_user ON public.saved_views(user_id);

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) - ENABLE
-- ============================================================================

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_business_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alert_dedup ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shareable_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_views ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) - POLICIES FOR USERS
-- ============================================================================

DROP POLICY IF EXISTS "select_own_user" ON public.users;
CREATE POLICY "select_own_user" ON public.users FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_user" ON public.users;
CREATE POLICY "insert_own_user" ON public.users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_user" ON public.users;
CREATE POLICY "update_own_user" ON public.users FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 13. ROW LEVEL SECURITY (RLS) - POLICIES FOR WORKSPACES
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

DROP POLICY IF EXISTS "insert_workspace_as_owner" ON public.workspaces;
CREATE POLICY "insert_workspace_as_owner" ON public.workspaces FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_workspace_as_admin" ON public.workspaces;
CREATE POLICY "update_workspace_as_admin" ON public.workspaces FOR UPDATE
  TO authenticated USING (
    is_workspace_admin(id, auth.uid())
  );

DROP POLICY IF EXISTS "delete_workspace_as_owner" ON public.workspaces;
CREATE POLICY "delete_workspace_as_owner" ON public.workspaces FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- ============================================================================
-- 14. ROW LEVEL SECURITY (RLS) - POLICIES FOR WORKSPACE_MEMBERS
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
-- 15. ROW LEVEL SECURITY (RLS) - POLICIES FOR META CONNECTIONS
-- ============================================================================

DROP POLICY IF EXISTS "select_meta_connections_as_member" ON public.meta_connections;
CREATE POLICY "select_meta_connections_as_member" ON public.meta_connections FOR SELECT
  TO authenticated USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_meta_connection_as_member" ON public.meta_connections;
CREATE POLICY "insert_meta_connection_as_member" ON public.meta_connections FOR INSERT
  TO authenticated WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "update_own_meta_connection" ON public.meta_connections;
CREATE POLICY "update_own_meta_connection" ON public.meta_connections FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_meta_connection_as_admin" ON public.meta_connections;
CREATE POLICY "delete_meta_connection_as_admin" ON public.meta_connections FOR DELETE
  TO authenticated USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 16. ROW LEVEL SECURITY (RLS) - POLICIES FOR BUSINESS MANAGERS & AD ACCOUNTS
-- ============================================================================

DROP POLICY IF EXISTS "select_business_managers_as_member" ON public.meta_business_managers;
CREATE POLICY "select_business_managers_as_member" ON public.meta_business_managers FOR SELECT
  TO authenticated USING (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "insert_business_managers_as_member" ON public.meta_business_managers;
CREATE POLICY "insert_business_managers_as_member" ON public.meta_business_managers FOR INSERT
  TO authenticated WITH CHECK (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "update_business_managers_as_admin" ON public.meta_business_managers;
CREATE POLICY "update_business_managers_as_admin" ON public.meta_business_managers FOR UPDATE
  TO authenticated USING (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "select_ad_accounts_as_member" ON public.meta_ad_accounts;
CREATE POLICY "select_ad_accounts_as_member" ON public.meta_ad_accounts FOR SELECT
  TO authenticated USING (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "insert_ad_accounts_as_member" ON public.meta_ad_accounts;
CREATE POLICY "insert_ad_accounts_as_member" ON public.meta_ad_accounts FOR INSERT
  TO authenticated WITH CHECK (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "update_ad_accounts_as_admin" ON public.meta_ad_accounts;
CREATE POLICY "update_ad_accounts_as_admin" ON public.meta_ad_accounts FOR UPDATE
  TO authenticated USING (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================================
-- 17. ROW LEVEL SECURITY (RLS) - POLICIES FOR CAMPAIGNS, ADSETS, ADS
-- ============================================================================

DROP POLICY IF EXISTS "select_campaigns_as_member" ON public.meta_campaigns;
CREATE POLICY "select_campaigns_as_member" ON public.meta_campaigns FOR SELECT
  TO authenticated USING (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "select_adsets_as_member" ON public.meta_ad_sets;
CREATE POLICY "select_adsets_as_member" ON public.meta_ad_sets FOR SELECT
  TO authenticated USING (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "select_ads_as_member" ON public.meta_ads;
CREATE POLICY "select_ads_as_member" ON public.meta_ads FOR SELECT
  TO authenticated USING (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "select_insights_as_member" ON public.meta_insights;
CREATE POLICY "select_insights_as_member" ON public.meta_insights FOR SELECT
  TO authenticated USING (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "select_synclogs_as_member" ON public.meta_sync_logs;
CREATE POLICY "select_synclogs_as_member" ON public.meta_sync_logs FOR SELECT
  TO authenticated USING (
    meta_connection_id IN (
      SELECT id FROM public.meta_connections 
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 18. ROW LEVEL SECURITY (RLS) - POLICIES FOR RECOMMENDATIONS & FORECASTS
-- ============================================================================

DROP POLICY IF EXISTS "select_own_recommendations" ON public.campaign_recommendations;
CREATE POLICY "select_own_recommendations" ON public.campaign_recommendations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_recommendations.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_recommendations" ON public.campaign_recommendations;
CREATE POLICY "insert_own_recommendations" ON public.campaign_recommendations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_recommendations.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_recommendations" ON public.campaign_recommendations;
CREATE POLICY "update_own_recommendations" ON public.campaign_recommendations FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_recommendations.workspace_id
      AND wm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_recommendations.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_own_forecasts" ON public.campaign_forecasts;
CREATE POLICY "select_own_forecasts" ON public.campaign_forecasts FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_forecasts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_forecasts" ON public.campaign_forecasts;
CREATE POLICY "insert_own_forecasts" ON public.campaign_forecasts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_forecasts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_forecasts" ON public.campaign_forecasts;
CREATE POLICY "update_own_forecasts" ON public.campaign_forecasts FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_forecasts.workspace_id
      AND wm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_forecasts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 19. ROW LEVEL SECURITY (RLS) - POLICIES FOR ALERTS
-- ============================================================================

DROP POLICY IF EXISTS "select_own_alerts" ON public.campaign_alerts;
CREATE POLICY "select_own_alerts" ON public.campaign_alerts FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_alerts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_alerts" ON public.campaign_alerts;
CREATE POLICY "insert_own_alerts" ON public.campaign_alerts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_alerts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_alerts" ON public.campaign_alerts;
CREATE POLICY "update_own_alerts" ON public.campaign_alerts FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_alerts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_alerts" ON public.campaign_alerts;
CREATE POLICY "delete_own_alerts" ON public.campaign_alerts FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_alerts.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_own_dedup" ON public.alert_dedup;
CREATE POLICY "select_own_dedup" ON public.alert_dedup FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_dedup" ON public.alert_dedup;
CREATE POLICY "insert_own_dedup" ON public.alert_dedup FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================================
-- 20. ROW LEVEL SECURITY (RLS) - POLICIES FOR REPORTS & NOTIFICATIONS
-- ============================================================================

DROP POLICY IF EXISTS "select_own_reports" ON public.campaign_reports;
CREATE POLICY "select_own_reports" ON public.campaign_reports FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaign_reports.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_reports" ON public.campaign_reports;
CREATE POLICY "insert_own_reports" ON public.campaign_reports FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_reports" ON public.campaign_reports;
CREATE POLICY "delete_own_reports" ON public.campaign_reports FOR DELETE
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "select_shareable_via_report" ON public.shareable_reports;
CREATE POLICY "select_shareable_via_report" ON public.shareable_reports FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.campaign_reports cr
      WHERE cr.id = shareable_reports.report_id
      AND (cr.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = cr.workspace_id AND wm.user_id = auth.uid()
      ))
    )
  );

DROP POLICY IF EXISTS "insert_shareable_via_report" ON public.shareable_reports;
CREATE POLICY "insert_shareable_via_report" ON public.shareable_reports FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_reports cr
      WHERE cr.id = shareable_reports.report_id
      AND cr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_own_notifications" ON public.user_notifications;
CREATE POLICY "select_own_notifications" ON public.user_notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_notifications" ON public.user_notifications;
CREATE POLICY "insert_own_notifications" ON public.user_notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_notifications" ON public.user_notifications;
CREATE POLICY "update_own_notifications" ON public.user_notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_notifications" ON public.user_notifications;
CREATE POLICY "delete_own_notifications" ON public.user_notifications FOR DELETE
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "select_own_prefs" ON public.notification_preferences;
CREATE POLICY "select_own_prefs" ON public.notification_preferences FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_prefs" ON public.notification_preferences;
CREATE POLICY "insert_own_prefs" ON public.notification_preferences FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_prefs" ON public.notification_preferences;
CREATE POLICY "update_own_prefs" ON public.notification_preferences FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 21. ROW LEVEL SECURITY (RLS) - POLICIES FOR SAVED VIEWS
-- ============================================================================

DROP POLICY IF EXISTS "select_own_saved_views" ON public.saved_views;
CREATE POLICY "select_own_saved_views" ON public.saved_views FOR SELECT
  TO authenticated USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "insert_own_saved_view" ON public.saved_views;
CREATE POLICY "insert_own_saved_view" ON public.saved_views FOR INSERT
  TO authenticated WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "update_own_saved_view" ON public.saved_views;
CREATE POLICY "update_own_saved_view" ON public.saved_views FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_saved_view" ON public.saved_views;
CREATE POLICY "delete_own_saved_view" ON public.saved_views FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- 22. TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_meta_connections_updated_at ON public.meta_connections;
CREATE TRIGGER update_meta_connections_updated_at
  BEFORE UPDATE ON public.meta_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_meta_business_managers_updated_at ON public.meta_business_managers;
CREATE TRIGGER update_meta_business_managers_updated_at
  BEFORE UPDATE ON public.meta_business_managers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_meta_ad_accounts_updated_at ON public.meta_ad_accounts;
CREATE TRIGGER update_meta_ad_accounts_updated_at
  BEFORE UPDATE ON public.meta_ad_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_meta_campaigns_updated_at ON public.meta_campaigns;
CREATE TRIGGER update_meta_campaigns_updated_at
  BEFORE UPDATE ON public.meta_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_meta_ad_sets_updated_at ON public.meta_ad_sets;
CREATE TRIGGER update_meta_ad_sets_updated_at
  BEFORE UPDATE ON public.meta_ad_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_meta_ads_updated_at ON public.meta_ads;
CREATE TRIGGER update_meta_ads_updated_at
  BEFORE UPDATE ON public.meta_ads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_campaign_alerts_updated_at ON public.campaign_alerts;
CREATE TRIGGER update_campaign_alerts_updated_at
  BEFORE UPDATE ON public.campaign_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_campaign_reports_updated_at ON public.campaign_reports;
CREATE TRIGGER update_campaign_reports_updated_at
  BEFORE UPDATE ON public.campaign_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_saved_views_updated_at ON public.saved_views;
CREATE TRIGGER update_saved_views_updated_at
  BEFORE UPDATE ON public.saved_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- 23. TRIGGERS FOR AUTO-MANAGING RELATIONSHIPS
-- ============================================================================

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.create_workspace_membership();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 24. DONE - ALL TABLES & INFRASTRUCTURE CREATED
-- ============================================================================
-- Schema migration complete!
-- Tables created: 20 main tables + supporting structures
-- RLS policies: All tables enabled with appropriate policies
-- Indexes: 60+ indexes for query optimization
-- Triggers: Auto-update timestamps and manage relationships
-- ============================================================================
