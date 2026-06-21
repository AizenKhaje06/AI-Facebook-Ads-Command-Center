import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { code, state, workspace_id } = body

  if (!code || !workspace_id) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  // Verify user has access to this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Call the edge function to handle the OAuth callback
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const response = await fetch(`${supabaseUrl}/functions/v1/meta-oauth?action=callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      code,
      state,
      workspace_id,
      user_id: user.id
    })
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json({ error: data.error || 'Failed to connect Meta account' }, { status: 500 })
  }

  return NextResponse.json(data)
}
