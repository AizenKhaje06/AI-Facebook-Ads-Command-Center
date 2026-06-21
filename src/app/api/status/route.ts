/**
 * System Status Dashboard
 * Provides comprehensive system health and statistics
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { metrics } from '@/lib/metrics'
import { syncQueue, alertQueue, reportQueue } from '@/lib/jobs/queue.stub'

export async function GET() {
  const supabase = await createClient()

  try {
    // 1. Database stats
    const [
      { count: totalUsers },
      { count: totalWorkspaces },
      { count: totalConnections },
      { count: totalCampaigns },
      { count: activeAlerts },
      { count: pendingRecommendations },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('workspaces').select('*', { count: 'exact', head: true }),
      supabase.from('meta_connections').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('meta_campaigns').select('*', { count: 'exact', head: true }),
      supabase.from('campaign_alerts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('campaign_recommendations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])

    // 2. Recent sync activity (last 24 hours)
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const { data: recentSyncs } = await supabase
      .from('meta_sync_logs')
      .select('status')
      .gte('created_at', yesterday)

    const syncStats = {
      total: recentSyncs?.length || 0,
      completed: recentSyncs?.filter(s => s.status === 'completed').length || 0,
      failed: recentSyncs?.filter(s => s.status === 'failed').length || 0,
      running: recentSyncs?.filter(s => s.status === 'running').length || 0,
    }

    // 3. Job queue stats
    const [syncJobCounts, alertJobCounts, reportJobCounts] = await Promise.all([
      syncQueue.getJobCounts(),
      alertQueue.getJobCounts(),
      reportQueue.getJobCounts(),
    ])

    const queueStats = {
      sync: syncJobCounts,
      alerts: alertJobCounts,
      reports: reportJobCounts,
    }

    // 4. System metrics
    const memUsage = process.memoryUsage()
    const systemMetrics = {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
    }

    // 5. Application metrics
    const appMetrics = metrics.getJSON()

    // 6. Last sync times per connection
    const { data: lastSyncs } = await supabase
      .from('meta_connections')
      .select('id, facebook_user_name, last_synced_at, status')
      .eq('status', 'active')
      .order('last_synced_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      database: {
        users: totalUsers || 0,
        workspaces: totalWorkspaces || 0,
        activeConnections: totalConnections || 0,
        campaigns: totalCampaigns || 0,
        activeAlerts: activeAlerts || 0,
        pendingRecommendations: pendingRecommendations || 0,
      },
      sync: {
        last24Hours: syncStats,
        recentSyncs: lastSyncs,
      },
      queues: queueStats,
      system: systemMetrics,
      metrics: appMetrics,
    })
  } catch (error) {
    console.error('Status endpoint error:', error)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
