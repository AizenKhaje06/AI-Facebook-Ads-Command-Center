import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const connectionId = searchParams.get('connection_id')

  if (!connectionId) {
    return NextResponse.json({ error: 'connection_id is required' }, { status: 400 })
  }

  // Verify user has access to this connection
  const { data: connection } = await supabase
    .from('meta_connections')
    .select('workspace_id')
    .eq('id', connectionId)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', connection.workspace_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Get sync logs
  const { data: logs, error: logsError } = await supabase
    .from('meta_sync_logs')
    .select('*')
    .eq('meta_connection_id', connectionId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (logsError) {
    console.error('Error fetching sync logs:', logsError)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }

  // Get sync state summary
  const { data: syncState } = await supabase
    .from('meta_sync_logs')
    .select('entity_type, completed_at, status')
    .eq('meta_connection_id', connectionId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  // Group by entity type to get last successful sync
  const stateMap = new Map()
  syncState?.forEach(log => {
    if (!stateMap.has(log.entity_type)) {
      stateMap.set(log.entity_type, {
        entity_type: log.entity_type,
        last_sync_at: log.completed_at,
        last_successful_sync_at: log.completed_at,
        error_count: 0
      })
    }
  })

  return NextResponse.json({
    logs: logs || [],
    syncState: Array.from(stateMap.values())
  })
}
