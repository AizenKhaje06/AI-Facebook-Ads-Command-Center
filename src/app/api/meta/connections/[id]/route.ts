import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: connectionId } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the connection and verify access
  const { data: connection, error: fetchError } = await supabase
    .from('meta_connections')
    .select('workspace_id')
    .eq('id', connectionId)
    .single()

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Verify user has admin access to this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', connection.workspace_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Delete the connection (cascade will delete related records)
  const { error: deleteError } = await supabase
    .from('meta_connections')
    .delete()
    .eq('id', connectionId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: connectionId } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { status } = body

  // Get the connection and verify access
  const { data: connection } = await supabase
    .from('meta_connections')
    .select('workspace_id')
    .eq('id', connectionId)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Verify user has admin access to this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', connection.workspace_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Update the connection status
  const { error: updateError } = await supabase
    .from('meta_connections')
    .update({ status })
    .eq('id', connectionId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
