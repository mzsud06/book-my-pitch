import { LegalPage } from '@/components/LegalPage'

export const metadata = { title: 'Privacy Policy | BookMyPitch' }

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="2 August 2026"
      intro="This explains what personal data BookMyPitch collects, why, and your rights over it."
    >
      <h2>1. Who we are</h2>
      <p>
        BookMyPitch is the data controller for the personal data described below. BookMyPitch is operated by
        Mohammed Rahman Masud, trading as a sole trader based in London. Contact us about privacy at{' '}
        <a href="mailto:masud@bookmypitch.uk" style={{ color: 'var(--green)' }}>masud@bookmypitch.uk</a>.
      </p>
      <p>
        We are not yet registered with the Information Commissioner&apos;s Office (ICO). BookMyPitch currently has
        no live venues and is not processing any real player or venue data. We will complete ICO registration
        before the first venue goes live and add the registration number here at that point.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li><strong>Account details</strong>: name, email address, and (for guest players) a phone number.</li>
        <li>
          <strong>Payment details</strong>: handled entirely by our payment processor, Stripe. We never see or
          store your full card number; Stripe gives us a reference token (a payment method ID) so we can request
          an authorisation or charge, and a masked/summary description of the card.
        </li>
        <li><strong>Booking activity</strong>: games you&apos;ve joined or organised, messages sent within a game&apos;s chat.</li>
        <li>
          <strong>Technical data</strong>: IP address (used to rate-limit abuse of signup/booking endpoints), and
          error/crash reports via Sentry, our error-monitoring provider.
        </li>
        <li>
          <strong>Venue owner details</strong>: for venue owners, your venue&apos;s name and address, and (via
          Stripe Connect) identity verification and bank account details handled directly by Stripe. We never see
          your bank details.
        </li>
      </ul>

      <h2>3. Why we collect it</h2>
      <p>We use your data to:</p>
      <ul>
        <li>Coordinate group bookings and confirm games (contractual necessity: we can&apos;t run the service without this).</li>
        <li>Process payments and payouts via Stripe (contractual necessity).</li>
        <li>Send booking-related notifications (game confirmed, cancelled, a spot freed up, etc).</li>
        <li>Prevent abuse and fraud, e.g. rate-limiting repeated signup or payment attempts (legitimate interest).</li>
        <li>Diagnose and fix errors via Sentry crash reports (legitimate interest).</li>
      </ul>
      <p>We do not sell your data, and we do not use it for advertising or marketing profiling.</p>

      <h2>4. Who we share it with</h2>
      <ul>
        <li><strong>Stripe</strong>: processes all payments and (for venue owners) payouts. Stripe is its own independent data controller for the payment data it handles; see Stripe&apos;s own privacy policy.</li>
        <li><strong>Supabase</strong>: hosts our database and handles account authentication.</li>
        <li><strong>Sentry</strong>: receives error/crash reports to help us fix bugs; these can include technical context but not your payment details.</li>
        <li>Other players in a game you join can see your name (and phone number, if you joined as a guest) as part of the game roster, which is necessary for group coordination.</li>
      </ul>
      <p>We don&apos;t share your data with anyone else, including for marketing purposes.</p>

      <h2>5. How long we keep it</h2>
      <p>
        We keep account and booking data for as long as your account is active, and for up to 6 years afterward, in
        line with HMRC&apos;s record-keeping requirements for financial and accounting records. You can ask us to
        delete your account at any time (see your rights below), though we may need to retain limited transaction
        records for that period regardless, to meet our legal obligations.
      </p>

      <h2 id="cookies">6. Cookies and local storage</h2>
      <p>
        We only use cookies and browser storage that are necessary to run the service. We don&apos;t use any
        advertising, analytics, or cross-site tracking cookies, and we never sell or profile your browsing activity.
      </p>
      <ul>
        <li><strong>Sign-in cookies</strong> (set by Supabase, our authentication provider): keep you logged in between visits.</li>
        <li><strong>Payment cookies</strong> (set by Stripe when you enter card details): required by Stripe to detect card fraud during checkout. We don&apos;t control these directly; see Stripe&apos;s own cookie policy.</li>
        <li>
          <strong>Local storage</strong>{' '}
          (kept in your browser, not sent to us as a cookie): if you book as a guest
          without an account, we store your name/phone and which games you&apos;ve joined locally on your device so
          you can find &ldquo;My Bookings&rdquo; again without logging in, and it expires automatically after 7 days.
          If you&apos;re part-way through listing a venue, we also save your form progress locally so a closed tab
          doesn&apos;t lose your work.
        </li>
      </ul>
      <p>
        Because none of these are used for advertising, analytics, or tracking, none require your consent under UK
        law, but we&apos;re telling you about them anyway. You can clear cookies/local storage at any time via your
        browser settings, though sign-in and guest-booking features won&apos;t work properly until you sign back in
        or rejoin.
      </p>

      <h2>7. Your rights</h2>
      <p>Under UK GDPR, you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Ask us to correct inaccurate data.</li>
        <li>Ask us to delete your data (&ldquo;right to be forgotten&rdquo;), subject to any legal retention requirements.</li>
        <li>Object to or restrict certain processing.</li>
        <li>Request a portable copy of your data.</li>
        <li>Complain to the UK Information Commissioner&apos;s Office (ICO) if you think we&apos;ve mishandled your data: <a href="https://ico.org.uk" style={{ color: 'var(--green)' }} target="_blank" rel="noopener noreferrer">ico.org.uk</a>.</li>
      </ul>
      <p>
        To exercise any of these, email{' '}
        <a href="mailto:masud@bookmypitch.uk" style={{ color: 'var(--green)' }}>masud@bookmypitch.uk</a>.
      </p>

      <h2>8. Children</h2>
      <p>
        BookMyPitch accounts and payment methods are for users aged 18 and over. We don&apos;t knowingly collect
        data from children.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy from time to time; material changes will be flagged on this page with an updated
        date at the top.
      </p>
    </LegalPage>
  )
}
