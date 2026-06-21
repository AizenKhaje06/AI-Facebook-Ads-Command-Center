-- Meta connections table - stores Facebook account connections
CREATE TABLE public.meta_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Meta/Facebook user info
  facebook_user_id TEXT NOT NULL,
  facebook_user_name TEXT,
  facebook_user_email TEXT,
  facebook_user_picture_url TEXT,
  
  -- Encrypted tokens (encrypted using Supabase secrets)
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Scopes granted
  granted_scopes TEXT[],
  
  -- Connection status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disconnected', 'error')),
  last_error_message TEXT,
  last_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, facebook_user_id)
);

-- Business managers linked to Meta connections
CREATE TABLE public.meta_business_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  
  -- Business manager info from Meta
  business_manager_id TEXT NOT NULL,
  name TEXT NOT NULL,
  profile_picture_url TEXT,
  
  -- Sync status
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(meta_connection_id, business_manager_id)
);

-- Ad accounts linked to business managers
CREATE TABLE public.meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  business_manager_id UUID REFERENCES public.meta_business_managers(id) ON DELETE SET NULL,
  
  -- Ad account info from Meta
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_status INTEGER DEFAULT 1, -- 1 = ACTIVE, 2 = DISABLED, etc.
  currency TEXT DEFAULT 'USD',
  timezone_name TEXT,
  amount_spent DECIMAL(15,2) DEFAULT 0,
  balance DECIMAL(15,2) DEFAULT 0,
  
  -- Sync status
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(meta_connection_id, ad_account_id)
);

-- Create indexes
CREATE INDEX idx_meta_connections_workspace ON public.meta_connections(workspace_id);
CREATE INDEX idx_meta_connections_user ON public.meta_connections(user_id);
CREATE INDEX idx_meta_connections_facebook_user ON public.meta_connections(facebook_user_id);
CREATE INDEX idx_meta_business_managers_connection ON public.meta_business_managers(meta_connection_id);
CREATE INDEX idx_meta_ad_accounts_connection ON public.meta_ad_accounts(meta_connection_id);
CREATE INDEX idx_meta_ad_accounts_business ON public.meta_ad_accounts(business_manager_id);

-- Enable RLS
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_business_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meta_connections
CREATE POLICY "select_meta_connections_as_member" ON public.meta_connections FOR SELECT
  TO authenticated USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "insert_meta_connection_as_member" ON public.meta_connections FOR INSERT
  TO authenticated WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "update_own_meta_connection" ON public.meta_connections FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "delete_meta_connection_as_admin" ON public.meta_connections FOR DELETE
  TO authenticated USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for meta_business_managers
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

-- RLS Policies for meta_ad_accounts
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

-- Updated_at triggers
CREATE TRIGGER update_meta_connections_updated_at
  BEFORE UPDATE ON public.meta_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_meta_business_managers_updated_at
  BEFORE UPDATE ON public.meta_business_managers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_meta_ad_accounts_updated_at
  BEFORE UPDATE ON public.meta_ad_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();