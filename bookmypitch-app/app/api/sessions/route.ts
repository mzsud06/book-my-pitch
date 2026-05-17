import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { slotId, name, phone } = await req.json()

    if (!slotId || !name?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: slot } = await supabase
      .from('slots')
      .select('id')
      .eq('id', slotId)
      .single()

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    // Guard against races: if a filling session already exists, return it
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('slot_id', slotId)
      .eq('status', 'filling')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ sessionId: existing.id, existed: true })
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        slot_id: slotId,
        status: 'filling',
        organiser_name: name.trim(),
        organiser_phone: phone?.trim() ?? null,
      })
      .select('id')
      .single()

    if (error || !session) {
      console.error('create session error:', error)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({ sessionId: session.id })
  } catch (err) {
    console.error('sessions route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
