import nodemailer from 'nodemailer'
import { createServiceClient } from '@/lib/supabase/service'

// Best-effort: an email failure must never break a join.
async function send(to: string, subject: string, text: string): Promise<void> {
  const user = process.env.ADMIN_ALERT_SMTP_USER
  const pass = process.env.ADMIN_ALERT_SMTP_PASS
  if (!user || !pass) {
    console.warn('gameEmail: SMTP env vars not configured, skipping email')
    return
  }
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.eu',
      port: 465,
      secure: true,
      auth: { user, pass },
    })
    await transporter.sendMail({ from: user, to, subject, text })
  } catch (err) {
    console.error('gameEmail: send failed', err)
  }
}

export async function emailOrganiserGameFull(opts: {
  organiserId: string
  gameId: string
  title: string
  venueName: string
  when: string
  hours: number
}): Promise<void> {
  const svc = createServiceClient()
  const { data } = await svc.auth.admin.getUserById(opts.organiserId)
  const to = data?.user?.email
  if (!to) return

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bookmypitch.uk'
  await send(
    to,
    `Your game is full: book the pitch now`,
    [
      `Everyone has paid for "${opts.title}" (${opts.venueName}, ${opts.when}).`,
      ``,
      `Book the pitch now, then confirm it here: ${base}/game/${opts.gameId}`,
      ``,
      `Tap "I've booked it" and the money is taken from the players and sent to you.`,
      `If the slot has gone, tap "Slot's gone" and nobody is charged.`,
      ``,
      `You have ${opts.hours} hours. After that the game cancels itself and nobody is charged.`,
    ].join('\n'),
  )
}
