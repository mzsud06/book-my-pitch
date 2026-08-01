import { LegalPage } from '@/components/LegalPage'

export const metadata = { title: 'Terms of Service | BookMyPitch' }

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="1 August 2026"
      intro="These terms cover how BookMyPitch works for both players and venue owners. Please read them before booking or listing a venue."
    >
      <h2>1. Who we are</h2>
      <p>
        BookMyPitch (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;BookMyPitch.uk&rdquo;) operates a platform connecting groups of
        players with football pitch venues in the UK. BookMyPitch is operated by Mohammed Rahman Masud, trading as
        a sole trader based in London.
        Contact us at <a href="mailto:masud@bookmypitch.uk" style={{ color: 'var(--green)' }}>masud@bookmypitch.uk</a>.
      </p>
      <p>
        BookMyPitch is a booking and payment platform. We do not own or operate the venues listed on the site.
        Each venue is operated by its own independent owner, who is responsible for the pitch itself (condition,
        safety, availability, and their own health &amp; safety obligations).
      </p>

      <h2>2. Accounts</h2>
      <p>
        You must be at least 18 years old to create an account, hold a saved payment method, or organise a game.
        You&apos;re responsible for keeping your login details secure and for all activity under your account.
        Guest players (added by name and phone number by an organiser, without creating an account) may join
        private games without registering, but still need a valid saved payment method to hold a spot.
      </p>

      <h2>3. How booking and payment works</h2>
      <p>
        Each bookable slot requires a fixed number of players (set by the venue&apos;s pitch format, typically 10 for
        5-a-side) to join before it is confirmed. When you join a game, you save a payment card via our payment
        processor, Stripe. <strong>Your card is authorised, not charged, at this point.</strong> No money moves
        until the slot fills.
      </p>
      <p>
        The moment the final player joins, every player&apos;s saved card is charged at once and the booking is
        confirmed. If any player&apos;s card fails at that moment, nobody in the group is charged. The affected
        player(s) are removed so the group can find a replacement, and everyone else&apos;s hold is released at no
        cost.
      </p>
      <p>
        The price you pay is the venue&apos;s pitch price divided evenly between players, plus a platform fee (50p
        per player) and Stripe&apos;s card processing fee (shown as ~30p per player). These fees fund running the
        platform and are separate from what the venue receives.
      </p>

      <h2>4. Cancellations</h2>
      <ul>
        <li>Before a game fills: leave at any time, free of charge. Nothing was ever taken from your card.</li>
        <li>
          An organiser can cancel an unfilled private or open game at any time; every player is notified and no
          one is charged.
        </li>
        <li>
          Once a game is confirmed (fully paid), it cannot be cancelled through the platform, and there is no
          automatic refund for not attending. If you can&apos;t make a confirmed game, tell your organiser, as they may
          be able to find a replacement player, but that&apos;s between players, not something BookMyPitch arranges
          or guarantees.
        </li>
        <li>
          If two groups are both trying to fill the same slot, the group that confirms first gets it. The other
          group is automatically cancelled and notified, with no charge made to any of its players.
        </li>
      </ul>

      <h2>5. For venue owners</h2>
      <p>
        Listing a venue requires connecting a Stripe Connect account, which involves Stripe verifying your identity
        and bank details directly (we never see or store your bank details). You set your own pricing; BookMyPitch
        does not take a cut of it. The platform fee is charged to players, on top of your price, not deducted from
        your payout.
      </p>
      <p>
        You&apos;re responsible for the accuracy of your listing (pricing, pitch format, availability) and for the
        condition and safety of your venue. Payouts are made automatically by Stripe once a booking is confirmed,
        subject to Stripe&apos;s own payout schedule and any verification requirements. We recommend venues carry
        appropriate public liability insurance. That is entirely your responsibility, not ours.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        Don&apos;t use the platform to harass other users, provide false identity or payment details, attempt to
        circumvent payment (e.g. arranging off-platform payment to avoid fees), or interfere with the service&apos;s
        operation. We may suspend or remove accounts that break these terms.
      </p>

      <h2>7. Liability</h2>
      <p>
        BookMyPitch is a booking and payment intermediary. We are not responsible for injuries, property damage, or
        disputes arising from playing at a venue. That&apos;s between players and the venue. We aim to keep the
        platform accurate and available but don&apos;t guarantee it will be error-free or uninterrupted.
      </p>
      <p>
        To the fullest extent permitted by law, our total liability to you for any claim arising from your use of
        BookMyPitch is limited to the platform fees you paid us (not amounts passed through to venues or Stripe) in
        the 12 months before the claim arose. We are not liable for indirect or consequential losses, such as loss
        of profit or a missed event.
      </p>
      <p>
        Nothing in these terms excludes or limits liability where it would be unlawful to do so, including
        liability for death or personal injury caused by negligence, or for fraud, and nothing here affects your
        statutory rights as a consumer under the Consumer Rights Act 2015.
      </p>

      <h2>8. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Continuing to use BookMyPitch after a change means you accept
        the updated terms. Material changes will be flagged on this page.
      </p>

      <h2>9. Governing law</h2>
      <p>These terms are governed by the laws of England and Wales.</p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms:{' '}
        <a href="mailto:masud@bookmypitch.uk" style={{ color: 'var(--green)' }}>masud@bookmypitch.uk</a>.
      </p>
    </LegalPage>
  )
}
