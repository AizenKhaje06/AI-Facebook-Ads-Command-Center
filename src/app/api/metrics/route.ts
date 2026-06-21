import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const entityType = searchParams.get('entity_type') || 'campaign'

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
  }

  // Verify access
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Get all connections for this workspace
  const { data: connections } = await supabase
    .from('meta_connections')
    .select('id')
    .eq('workspace_id', workspaceId)

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      totals: null,
      timeSeries: [],
      entities: [],
      hasData: false
    })
  }

  const connectionIds = connections.map(c => c.id)

  // Build insights query
  let query = supabase
    .from('meta_insights')
    .select('*')
    .in('meta_connection_id', connectionIds)
    .eq('entity_type', entityType)
    .order('date', { ascending: true })

  if (startDate) {
    query = query.gte('date', startDate)
  }

  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data: insights, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!insights || insights.length === 0) {
    return NextResponse.json({
      totals: null,
      timeSeries: [],
      entities: [],
      hasData: false
    })
  }

  // Calculate totals across all entities
  const totals = insights.reduce((acc: any, insight: any) => {
    acc.spend += insight.spend || 0
    acc.impressions += insight.impressions || 0
    acc.clicks += insight.clicks || 0
    acc.conversions += insight.conversions || 0
    acc.purchase_value += insight.purchase_value || 0
    acc.reach += insight.reach || 0
    acc.purchases += insight.purchases || 0
    acc.add_to_cart += insight.add_to_cart || 0
    acc.checkout += insight.checkout || 0
    acc.leads += insight.leads || 0
    acc.video_p100_watched += insight.video_p100_watched_actions || 0
    return acc
  }, {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    purchase_value: 0,
    reach: 0,
    purchases: 0,
    add_to_cart: 0,
    checkout: 0,
    leads: 0,
    video_p100_watched: 0
  })

  // Calculate derived metrics
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  totals.roas = totals.spend > 0 ? totals.purchase_value / totals.spend : 0
  totals.cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0

  // Time series aggregation
  const timeSeriesMap = insights.reduce((acc: Record<string, any>, insight: any) => {
    const date = insight.date
    if (!acc[date]) {
      acc[date] = {
        date,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        purchase_value: 0,
        reach: 0,
        purchases: 0,
        add_to_cart: 0,
        checkout: 0,
        leads: 0,
        video_p100_watched: 0,
      }
    }
    acc[date].spend += insight.spend || 0
    acc[date].impressions += insight.impressions || 0
    acc[date].clicks += insight.clicks || 0
    acc[date].conversions += insight.conversions || 0
    acc[date].purchase_value += insight.purchase_value || 0
    acc[date].reach += insight.reach || 0
    acc[date].purchases += insight.purchases || 0
    acc[date].add_to_cart += insight.add_to_cart || 0
    acc[date].checkout += insight.checkout || 0
    acc[date].leads += insight.leads || 0
    acc[date].video_p100_watched += insight.video_p100_watched_actions || 0
    return acc
  }, {})

  const timeSeries = Object.values(timeSeriesMap).sort((a: any, b: any) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return NextResponse.json({
    totals,
    timeSeries,
    hasData: true,
    dateRange: {
      start: startDate || insights[insights.length - 1]?.date,
      end: endDate || insights[0]?.date
    }
  })
}
