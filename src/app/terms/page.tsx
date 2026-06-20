import LegalLayout from '@/components/LegalLayout'

export const metadata = { title: 'Terms of Service — AI Creative Studio' }

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="June 21, 2026">
      <p>
        These terms govern your use of AI Creative Studio (&quot;the service&quot;). By using the service, you
        agree to them. If you don&apos;t agree, please don&apos;t use the service.
      </p>

      <h2>The service</h2>
      <p>
        AI Creative Studio turns a short brief into a video — a script, storyboard, AI-rendered clips, and
        social captions — across several content types. Generation relies on third-party AI providers (Google
        Gemini, fal.ai) and may occasionally fail, produce unexpected results, or take longer than expected; we
        don&apos;t guarantee a specific output quality or turnaround time.
      </p>

      <h2>Accounts and plans</h2>
      <ul>
        <li>The Free plan includes a limited number of videos per month, enforced server-side per account or anonymous visitor.</li>
        <li>Paid plans (Creator, Studio, Cinema) unlock additional generation capacity and features as described on our <a href="/pricing">pricing page</a>, billed monthly via Stripe.</li>
        <li>You can cancel a paid plan at any time from your account&apos;s billing portal. You&apos;ll keep access until the end of the period you&apos;ve already paid for.</li>
        <li>We offer a 7-day money-back guarantee on a first paid subscription — contact us to request a refund within that window.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You retain ownership of the briefs you submit and the videos generated from them. By submitting a
        brief, you grant us — and the third-party AI providers listed in our <a href="/privacy">Privacy
        Policy</a> — the rights needed to process it and generate your video. You&apos;re responsible for making
        sure you have the rights to any material you include in a brief.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use the service to generate content that is:</p>
      <ul>
        <li>Illegal, or that infringes someone else&apos;s intellectual property or rights;</li>
        <li>Sexually explicit, or sexualizes minors in any way;</li>
        <li>Intended to harass, defame, or impersonate a real person without consent;</li>
        <li>Otherwise in violation of the acceptable-use policies of the underlying AI providers we rely on.</li>
      </ul>
      <p>We may suspend or terminate accounts that violate this section.</p>

      <h2>Service availability</h2>
      <p>
        We aim to keep the service available and reliable, but we don&apos;t guarantee uninterrupted access. We
        may modify, suspend, or discontinue parts of the service at any time, including the underlying AI
        providers it depends on.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        The service is provided &quot;as is.&quot; To the maximum extent permitted by law, we are not liable for
        indirect, incidental, or consequential damages arising from your use of the service, including from AI
        provider outages, content generation failures, or content quality.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms as the service changes. Continued use of the service after an update means
        you accept the revised terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email <a href="mailto:support@aicreativestudio.app">support@aicreativestudio.app</a>.
      </p>
    </LegalLayout>
  )
}
