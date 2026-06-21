import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { connectionId, adAccountId, entityType, syncType, daysBack } = body

  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId is required' }, { status: 400 })
  }

  // Get connection details with decrypted token
  const { data: connection, error: connError } = await supabase
    .from('meta_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Verify user has access to this connection's workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', connection.workspace_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Decrypt access token
  const accessToken = Buffer.from(connection.encrypted_access_token, 'base64').toString()

  try {
    // Fetch ad accounts from Meta if not specified
    let adAccountIds: string[] = []
    
    if (adAccountId) {
      adAccountIds = [adAccountId]
    } else {
      // Get all ad accounts for this user
      const adAccountsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
      )
      const adAccountsData = await adAccountsResponse.json()

      if (adAccountsData.error) {
        throw new Error(adAccountsData.error.message || 'Failed to fetch ad accounts')
      }

      adAccountIds = adAccountsData.data?.map((acc: any) => acc.id) || []
      
      // Save ad accounts to database
      for (const account of adAccountsData.data || []) {
        await supabase
          .from('ad_accounts')
          .upsert({
            connection_id: connectionId,
            account_id: account.id,
            account_name: account.name,
            account_status: account.account_status,
            currency: 'USD', // Will be updated in detailed sync
          }, {
            onConflict: 'connection_id,account_id'
          })
      }
    }

    // Sync campaigns for each ad account
    let totalCampaigns = 0
    let totalAdSets = 0
    let totalAds = 0

    for (const accountId of adAccountIds) {
      // Sync Campaigns
      if (!entityType || entityType === 'all' || entityType === 'campaigns') {
        const campaignsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${accountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time&access_token=${accessToken}`
        )
        const campaignsData = await campaignsResponse.json()

        if (!campaignsData.error && campaignsData.data) {
          for (const campaign of campaignsData.data) {
            await supabase
              .from('campaigns')
              .upsert({
                connection_id: connectionId,
                ad_account_id: accountId,
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                status: campaign.status,
                objective: campaign.objective,
                daily_budget: campaign.daily_budget,
                lifetime_budget: campaign.lifetime_budget,
              }, {
                onConflict: 'connection_id,campaign_id'
              })
            totalCampaigns++
          }
        }
      }

      // Sync Ad Sets
      if (!entityType || entityType === 'all' || entityType === 'adsets') {
        const adsetsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${accountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,created_time,updated_time&access_token=${accessToken}`
        )
        const adsetsData = await adsetsResponse.json()

        if (!adsetsData.error && adsetsData.data) {
          for (const adset of adsetsData.data) {
            await supabase
              .from('adsets')
              .upsert({
                connection_id: connectionId,
                campaign_id: adset.campaign_id,
                adset_id: adset.id,
                adset_name: adset.name,
                status: adset.status,
                daily_budget: adset.daily_budget,
                lifetime_budget: adset.lifetime_budget,
                targeting: adset.targeting,
              }, {
                onConflict: 'connection_id,adset_id'
              })
            totalAdSets++
          }
        }
      }

      // Sync Ads
      if (!entityType || entityType === 'all' || entityType === 'ads') {
        const adsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${accountId}/ads?fields=id,name,status,adset_id,creative{id,title,body,image_url},created_time,updated_time&access_token=${accessToken}`
        )
        const adsData = await adsResponse.json()

        if (!adsData.error && adsData.data) {
          for (const ad of adsData.data) {
            await supabase
              .from('ads')
              .upsert({
                connection_id: connectionId,
                adset_id: ad.adset_id,
                ad_id: ad.id,
                ad_name: ad.name,
                status: ad.status,
                creative: ad.creative,
              }, {
                onConflict: 'connection_id,ad_id'
              })
            totalAds++
          }
        }
      }
    }

    // Update connection's last synced time
    await supabase
      .from('meta_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connectionId)

    // Create sync log
    await supabase
      .from('sync_logs')
      .insert({
        connection_id: connectionId,
        sync_type: syncType || 'manual',
        entity_type: entityType || 'all',
        status: 'completed',
        records_synced: totalCampaigns + totalAdSets + totalAds,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })

    return NextResponse.json({
      success: true,
      synced: {
        campaigns: totalCampaigns,
        adsets: totalAdSets,
        ads: totalAds,
        total: totalCampaigns + totalAdSets + totalAds
      }
    })

  } catch (error: any) {
    console.error('Sync error:', error)
    
    // Log failed sync
    await supabase
      .from('sync_logs')
      .insert({
        connection_id: connectionId,
        sync_type: syncType || 'manual',
        entity_type: entityType || 'all',
        status: 'failed',
        error_message: error.message,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })

    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}
