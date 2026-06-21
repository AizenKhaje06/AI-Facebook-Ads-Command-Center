import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/api-client'

export const maxDuration = 60 // Maximum execution time for Vercel Pro (60 seconds)

export async function POST(request: Request) {
  const startTime = Date.now()
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

  // Create sync log entry
  const { data: syncLog, error: logError } = await supabase
    .from('meta_sync_logs')
    .insert({
      meta_connection_id: connectionId,
      sync_type: syncType || 'manual',
      entity_type: entityType || 'all',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (logError) {
    console.error('Error creating sync log:', logError)
  }

  // Decrypt access token
  const accessToken = Buffer.from(connection.encrypted_access_token, 'base64').toString()
  
  // Create Meta API client with retry logic
  const metaClient = createMetaClient(accessToken)

  try {
    let adAccountIds: { uuid: string; metaId: string }[] = []
    
    if (adAccountId) {
      // Look up the UUID for this specific ad account
      const { data: account } = await supabase
        .from('meta_ad_accounts')
        .select('id, ad_account_id')
        .eq('meta_connection_id', connectionId)
        .eq('ad_account_id', adAccountId)
        .single()
      
      if (account) {
        adAccountIds = [{ uuid: account.id, metaId: account.ad_account_id }]
      }
    } else {
      // Get all ad accounts using new client
      console.log('Fetching ad accounts for connection:', connectionId)
      const adAccountsData = await metaClient.request<{ data: any[] }>('/me/adaccounts', {
        params: {
          fields: 'id,name,account_status,currency,timezone_name,amount_spent,balance'
        }
      })

      console.log(`Found ${adAccountsData.data?.length || 0} ad accounts`)
      
      // Save ad accounts to database (batch upsert) and get UUIDs
      if (adAccountsData.data && adAccountsData.data.length > 0) {
        const accountsToUpsert = adAccountsData.data.map(account => ({
          meta_connection_id: connectionId,
          ad_account_id: account.id,
          name: account.name,
          account_status: account.account_status,
          currency: account.currency || 'USD',
          timezone_name: account.timezone_name,
          amount_spent: account.amount_spent ? parseFloat(account.amount_spent) / 100 : 0,
          balance: account.balance ? parseFloat(account.balance) / 100 : 0,
          last_synced_at: new Date().toISOString(),
        }))
        
        const { data: upsertedAccounts } = await supabase
          .from('meta_ad_accounts')
          .upsert(accountsToUpsert, {
            onConflict: 'meta_connection_id,ad_account_id'
          })
          .select('id, ad_account_id')
        
        if (upsertedAccounts) {
          adAccountIds = upsertedAccounts.map(acc => ({
            uuid: acc.id,
            metaId: acc.ad_account_id
          }))
        }
      }
    }

    let totalCampaigns = 0
    let totalAdSets = 0
    let totalAds = 0
    let processedRecords = 0

    // Process ad accounts with timeout protection (limit to first 5 to prevent timeout)
    const accountsToProcess = adAccountIds.slice(0, 5)
    console.log(`Processing ${accountsToProcess.length} of ${adAccountIds.length} ad accounts`)

    for (const account of accountsToProcess) {
      try {
        console.log(`Syncing account: ${account.metaId}`)
        
        // Build batch requests for efficient syncing
        const batchRequests = []

        if (!entityType || entityType === 'all' || entityType === 'campaigns') {
          batchRequests.push({
            method: 'GET' as const,
            relative_url: `${account.metaId}/campaigns?fields=id,name,status,objective,buying_type,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,effective_status,created_time,updated_time&limit=500`
          })
        }

        if (!entityType || entityType === 'all' || entityType === 'adsets') {
          batchRequests.push({
            method: 'GET' as const,
            relative_url: `${account.metaId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,bid_strategy,start_time,end_time,effective_status,created_time,updated_time&limit=500`
          })
        }

        if (!entityType || entityType === 'all' || entityType === 'ads') {
          batchRequests.push({
            method: 'GET' as const,
            relative_url: `${account.metaId}/ads?fields=id,name,status,adset_id,campaign_id,creative{id,title,body,image_url,object_story_spec},effective_status,created_time,updated_time&limit=500`
          })
        }

        if (batchRequests.length === 0) continue

        // Execute batch request with timeout
        const batchResults = await Promise.race([
          metaClient.batch(batchRequests),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Batch request timeout')), 30000)
          )
        ])

        let batchIndex = 0

        // Process campaigns
        if ((!entityType || entityType === 'all' || entityType === 'campaigns') && batchResults[batchIndex] && !(batchResults[batchIndex] instanceof Error)) {
          const campaignsData = batchResults[batchIndex] as { data: any[] }
          if (campaignsData.data && campaignsData.data.length > 0) {
            const campaignsToUpsert = campaignsData.data.map(campaign => ({
              meta_connection_id: connectionId,
              ad_account_id: account.uuid,
              campaign_id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              effective_status: campaign.effective_status,
              objective: campaign.objective,
              buying_type: campaign.buying_type,
              daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
              lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
              budget_remaining: campaign.budget_remaining ? parseFloat(campaign.budget_remaining) / 100 : null,
              start_time: campaign.start_time,
              stop_time: campaign.stop_time,
              last_synced_at: new Date().toISOString(),
            }))
            
            await supabase
              .from('meta_campaigns')
              .upsert(campaignsToUpsert, {
                onConflict: 'ad_account_id,campaign_id'
              })
            
            totalCampaigns += campaignsData.data.length
            processedRecords += campaignsData.data.length
            console.log(`Synced ${campaignsData.data.length} campaigns for ${account.metaId}`)
          }
          batchIndex++
        }

        // Process ad sets
        if ((!entityType || entityType === 'all' || entityType === 'adsets') && batchResults[batchIndex] && !(batchResults[batchIndex] instanceof Error)) {
          const adsetsData = batchResults[batchIndex] as { data: any[] }
          if (adsetsData.data && adsetsData.data.length > 0) {
            // First, we need to map campaign_id (Meta ID) to campaign UUID
            const campaignMetaIds = [...new Set(adsetsData.data.map(a => a.campaign_id).filter(Boolean))]
            const { data: campaignMappings } = await supabase
              .from('meta_campaigns')
              .select('id, campaign_id')
              .eq('ad_account_id', account.uuid)
              .in('campaign_id', campaignMetaIds)
            
            const campaignMap = new Map(campaignMappings?.map(c => [c.campaign_id, c.id]) || [])
            
            const adsetsToUpsert = adsetsData.data
              .filter(adset => campaignMap.has(adset.campaign_id))
              .map(adset => ({
                meta_connection_id: connectionId,
                ad_account_id: account.uuid,
                campaign_id: campaignMap.get(adset.campaign_id),
                adset_id: adset.id,
                name: adset.name,
                campaign_id_meta: adset.campaign_id,
                status: adset.status,
                effective_status: adset.effective_status,
                optimization_goal: adset.optimization_goal,
                billing_event: adset.billing_event,
                bid_strategy: adset.bid_strategy,
                daily_budget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : null,
                lifetime_budget: adset.lifetime_budget ? parseFloat(adset.lifetime_budget) / 100 : null,
                targeting: adset.targeting,
                start_time: adset.start_time,
                end_time: adset.end_time,
                last_synced_at: new Date().toISOString(),
              }))
            
            if (adsetsToUpsert.length > 0) {
              await supabase
                .from('meta_ad_sets')
                .upsert(adsetsToUpsert, {
                  onConflict: 'ad_account_id,adset_id'
                })
              
              totalAdSets += adsetsToUpsert.length
              processedRecords += adsetsToUpsert.length
              console.log(`Synced ${adsetsToUpsert.length} ad sets for ${account.metaId}`)
            }
          }
          batchIndex++
        }

        // Process ads
        if ((!entityType || entityType === 'all' || entityType === 'ads') && batchResults[batchIndex] && !(batchResults[batchIndex] instanceof Error)) {
          const adsData = batchResults[batchIndex] as { data: any[] }
          if (adsData.data && adsData.data.length > 0) {
            // Map campaign_id and adset_id to UUIDs
            const campaignMetaIds = [...new Set(adsData.data.map(a => a.campaign_id).filter(Boolean))]
            const adsetMetaIds = [...new Set(adsData.data.map(a => a.adset_id).filter(Boolean))]
            
            const { data: campaignMappings } = await supabase
              .from('meta_campaigns')
              .select('id, campaign_id')
              .eq('ad_account_id', account.uuid)
              .in('campaign_id', campaignMetaIds)
            
            const { data: adsetMappings } = await supabase
              .from('meta_ad_sets')
              .select('id, adset_id')
              .eq('ad_account_id', account.uuid)
              .in('adset_id', adsetMetaIds)
            
            const campaignMap = new Map(campaignMappings?.map(c => [c.campaign_id, c.id]) || [])
            const adsetMap = new Map(adsetMappings?.map(a => [a.adset_id, a.id]) || [])
            
            const adsToUpsert = adsData.data
              .filter(ad => campaignMap.has(ad.campaign_id) && adsetMap.has(ad.adset_id))
              .map(ad => ({
                meta_connection_id: connectionId,
                ad_account_id: account.uuid,
                campaign_id: campaignMap.get(ad.campaign_id),
                ad_set_id: adsetMap.get(ad.adset_id),
                ad_id: ad.id,
                name: ad.name,
                adset_id_meta: ad.adset_id,
                campaign_id_meta: ad.campaign_id,
                status: ad.status,
                effective_status: ad.effective_status,
                creative: ad.creative,
                last_synced_at: new Date().toISOString(),
              }))
            
            if (adsToUpsert.length > 0) {
              await supabase
                .from('meta_ads')
                .upsert(adsToUpsert, {
                  onConflict: 'ad_account_id,ad_id'
                })
              
              totalAds += adsToUpsert.length
              processedRecords += adsToUpsert.length
              console.log(`Synced ${adsToUpsert.length} ads for ${account.metaId}`)
            }
          }
          batchIndex++
        }
      } catch (accountError: any) {
        console.error(`Error syncing account ${account.metaId}:`, accountError.message)
        // Continue with other accounts
      }
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000)
    
    // Update connection's last synced time
    await supabase
      .from('meta_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connectionId)

    // Update sync log
    if (syncLog) {
      await supabase
        .from('meta_sync_logs')
        .update({
          status: 'completed',
          total_records: totalCampaigns + totalAdSets + totalAds,
          processed_records: processedRecords,
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', syncLog.id)
    }

    console.log(`Sync completed in ${durationSeconds}s: ${totalCampaigns} campaigns, ${totalAdSets} ad sets, ${totalAds} ads`)

    return NextResponse.json({
      success: true,
      synced: {
        campaigns: totalCampaigns,
        adsets: totalAdSets,
        ads: totalAds,
        total: totalCampaigns + totalAdSets + totalAds
      },
      duration: durationSeconds,
      accountsProcessed: accountsToProcess.length,
      totalAccounts: adAccountIds.length
    })

  } catch (error: any) {
    console.error('Sync error:', error)
    
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000)
    
    // Update sync log to failed
    if (syncLog) {
      await supabase
        .from('meta_sync_logs')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', syncLog.id)
    }

    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}
