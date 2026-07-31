import nodemailer from 'nodemailer'

// Fires when a new venue signs up so admin_approved doesn't sit unnoticed —
// there's no other alert path, so a failure here must never break signup.
export async function notifyAdminNewVenueSignup(venue: {
  name: string
  address: string
  ownerEmail: string
}) {
  const user = process.env.ADMIN_ALERT_SMTP_USER
  const pass = process.env.ADMIN_ALERT_SMTP_PASS
  const to = process.env.ADMIN_ALERT_TO
  if (!user || !pass || !to) {
    console.warn('notifyAdminNewVenueSignup: SMTP env vars not configured, skipping alert')
    return
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.eu',
      port: 465,
      secure: true,
      auth: { user, pass },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bookmypitch.uk'

    await transporter.sendMail({
      from: user,
      to,
      subject: `New venue signup: ${venue.name} — needs approval`,
      text: `${venue.name}\n${venue.address}\nOwner: ${venue.ownerEmail}\n\nApprove at ${appUrl}/admin/venues`,
    })
  } catch (err) {
    console.error('notifyAdminNewVenueSignup failed:', err)
  }
}
