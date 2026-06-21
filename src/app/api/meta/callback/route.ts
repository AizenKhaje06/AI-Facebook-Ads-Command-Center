import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return redirect(`/settings/workspace?error=${encodeURIComponent(errorDescription || error)}`)
  }

  if (!code || !state) {
    return redirect('/settings/workspace?error=Missing OAuth parameters')
  }

  // Decode and verify state
  let stateData: { workspace_id: string; user_id: string; timestamp: number }
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    
    // Check if state is not too old (15 minutes)
    if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
      return redirect('/settings/workspace?error=OAuth state expired')
    }
  } catch (e) {
    return redirect('/settings/workspace?error=Invalid OAuth state')
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user || user.id !== stateData.user_id) {
    return redirect('/login?error=Unauthorized')
  }

  // Exchange code for access token
  const facebookAppId = process.env.FACEBOOK_APP_ID
  const facebookAppSecret = process.env.FACEBOOK_APP_SECRET
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI

  if (!facebookAppId || !facebookAppSecret || !redirectUri) {
    return redirect('/settings/workspace?error=Facebook app not configured')
  }

  try {
    // Step 1: Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', facebookAppId)
    tokenUrl.searchParams.set('client_secret', facebookAppSecret)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)

    const tokenResponse = await fetch(tokenUrl.toString())
    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || tokenData.error) {
      throw new Error(tokenData.error?.message || 'Failed to exchange token')
    }

    const { access_token } = tokenData

    // Step 2: Get user info from Facebook
    const meResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${access_token}`
    )
    const meData = await meResponse.json()

    if (!meResponse.ok || meData.error) {
      throw new Error(meData.error?.message || 'Failed to get user info')
    }

    // Step 3: Get long-lived token (60 days)
    const longTokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longTokenUrl.searchParams.set('client_id', facebookAppId)
    longTokenUrl.searchParams.set('client_secret', facebookAppSecret)
    longTokenUrl.searchParams.set('fb_exchange_token', access_token)

    const longTokenResponse = await fetch(longTokenUrl.toString())
    const longTokenData = await longTokenResponse.json()

    const finalToken = longTokenData.access_token || access_token
    const expiresIn = longTokenData.expires_in || 5184000 // 60 days default

    // Step 4: Encrypt token (simple base64 for now - use proper encryption in production!)
    const encryptedToken = Buffer.from(finalToken).toString('base64')

    // Step 5: Save connection to database
    const { data: connection, error: dbError } = await supabase
      .from('meta_connections')
      .upsert({
        workspace_id: stateData.workspace_id,
        user_id: user.id,
        facebook_user_id: meData.id,
        facebook_user_name: meData.name,
        facebook_user_email: meData.email,
        facebook_user_picture_url: meData.picture?.data?.url,
        encrypted_access_token: encryptedToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        granted_scopes: ['ads_read', 'ads_management', 'business_management'],
        status: 'active',
        last_synced_at: null,
      }, {
        onConflict: 'workspace_id,facebook_user_id'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('Failed to save connection')
    }

    // Redirect back to settings with success
    return redirect('/settings/workspace?success=Meta account connected successfully')
    
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return redirect(`/settings/workspace?error=${encodeURIComponent(error.message || 'Failed to connect Meta account')}`)
  }
}
