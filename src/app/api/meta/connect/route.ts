import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get workspace from query params
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
  }

  // Verify user has access to workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Build Facebook OAuth URL
  const facebookAppId = process.env.FACEBOOK_APP_ID
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI

  if (!facebookAppId || !redirectUri) {
    return NextResponse.json({ 
      error: 'Facebook app not configured. Please set FACEBOOK_APP_ID and FACEBOOK_REDIRECT_URI environment variables.' 
    }, { status: 500 })
  }

  // Required permissions for Meta Ads API
  const scope = [
    'ads_read',
    'ads_management',
    'business_management',
    'pages_read_engagement',
  ].join(',')

  // Build OAuth URL with state (includes workspace_id and user_id for security)
  const state = Buffer.from(JSON.stringify({
    workspace_id: workspaceId,
    user_id: user.id,
    timestamp: Date.now(),
  })).toString('base64')

  const oauthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
  oauthUrl.searchParams.set('client_id', facebookAppId)
  oauthUrl.searchParams.set('redirect_uri', redirectUri)
  oauthUrl.searchParams.set('scope', scope)
  oauthUrl.searchParams.set('state', state)
  oauthUrl.searchParams.set('response_type', 'code')

  return NextResponse.json({ url: oauthUrl.toString() })
}
