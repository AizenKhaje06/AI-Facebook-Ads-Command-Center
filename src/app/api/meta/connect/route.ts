import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the OAuth URL from the edge function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const response = await fetch(`${supabaseUrl}/functions/v1/meta-oauth?action=authorize`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    }
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json({ error: data.error || 'Failed to get OAuth URL' }, { status: 500 })
  }

  return NextResponse.json(data)
}
