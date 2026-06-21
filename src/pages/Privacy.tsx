import { Link } from "react-router-dom";

const LAST_UPDATED = "June 3, 2026";

const Privacy = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Last updated: {LAST_UPDATED}
      </p>

      <section className="space-y-5 text-sm leading-relaxed">
        <p>
          Ascend Vacation Rentals LLC ("Ascend," "we," "us," or "our") operates
          CleanOS, an internal operations platform used to coordinate cleaning
          work at short-term-rental properties Ascend manages. This Privacy
          Policy describes the personal information we collect from users of
          CleanOS, how we use and protect it, with whom we share it, and the
          rights you have over it.
        </p>
        <p>
          By creating a CleanOS account, providing your phone number, or
          otherwise using the service, you acknowledge that you have read and
          understood this Privacy Policy.
        </p>

        <h2 className="text-xl font-semibold pt-4">1. Who we are</h2>
        <p>
          The data controller responsible for the personal information described
          in this policy is:
        </p>
        <p className="pl-4 border-l-2 border-border">
          Ascend Vacation Rentals LLC<br />
          Eugene, Oregon, United States<br />
          Contact:{" "}
          <a className="underline" href="mailto:support@turnpoint.app">
            support@turnpoint.app
          </a>
        </p>

        <h2 className="text-xl font-semibold pt-4">
          2. Information we collect
        </h2>

        <h3 className="font-semibold mt-3">a. Information you provide directly</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Account information:</strong> full name, email address, and
            password (stored hashed, never in plaintext).
          </li>
          <li>
            <strong>Mobile phone number:</strong> only if you voluntarily add it
            on your CleanOS profile so we can send you operational text
            messages.
          </li>
          <li>
            <strong>Operational data you create in the app:</strong> notes,
            checked-off checklist items, before/after photos, and similar
            content you generate while completing or coordinating cleaning
            work.
          </li>
        </ul>

        <h3 className="font-semibold mt-3">b. Information from third parties</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Hostaway:</strong> we synchronize property listings and
            guest reservation details (guest name, arrival and departure dates)
            from Ascend's Hostaway account so that cleaning jobs can be
            scheduled around real bookings. We do not receive guest payment
            information.
          </li>
        </ul>

        <h3 className="font-semibold mt-3">c. Information collected automatically</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Authentication and session data:</strong> tokens stored in
            your browser's local storage so we can keep you signed in between
            visits.
          </li>
          <li>
            <strong>Technical data:</strong> limited information your browser
            sends with each request (IP address, browser type and version,
            operating system, referring page, timestamps). This is used to
            diagnose problems and protect against abuse.
          </li>
        </ul>

        <h2 className="text-xl font-semibold pt-4">
          3. How we use your information
        </h2>
        <p>We use personal information for the following purposes:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>To create and authenticate your CleanOS account.</li>
          <li>
            To authorize your access to work assigned to you under your role
            (admin, manager, technician, or owner).
          </li>
          <li>
            To send operational SMS notifications about cleaning jobs
            (assignment, schedule changes, completion confirmations, daily
            manager alerts) — only if you have provided a phone number.
          </li>
          <li>
            To enable managers and admins to coordinate cleaning operations
            across properties.
          </li>
          <li>
            To detect, prevent, and respond to security incidents, fraud,
            abuse, or violations of our Terms.
          </li>
          <li>To comply with legal obligations.</li>
        </ul>
        <p>
          We do <strong>not</strong> use your personal information for
          advertising, behavioral profiling, or sale to data brokers.
        </p>

        <h2 className="text-xl font-semibold pt-4">4. SMS notifications</h2>
        <p>
          See our{" "}
          <Link to="/sms-opt-in" className="underline">
            SMS Opt-In &amp; Consent page
          </Link>{" "}
          for the exact consent screen and opt-in steps.
        </p>
        <p>
          <strong>Program name:</strong> CleanOS Operational Notifications.
        </p>
        <p>
          <strong>Program sponsor:</strong> Ascend Vacation Rentals LLC.
        </p>
        <p>
          <strong>Program description:</strong> When you add a phone number to
          your CleanOS profile and check the SMS consent box on that page, you
          consent to receive operational SMS messages from Ascend about
          cleaning work assigned to you. We do not send any text messages
          unless you have affirmatively opted in; you can withdraw consent at
          any time by unchecking that box or replying STOP. Typical
          messages include job assignments, schedule changes, completion
          confirmations, and (for managers) daily 7:00am Pacific summaries of
          unassigned jobs. Message frequency varies based on operational
          activity, typically 1–10 messages per week per recipient.{" "}
          <strong>Message and data rates may apply.</strong>
        </p>
        <p>
          <strong>No third-party sharing of mobile information.</strong> Mobile
          information (including phone numbers, opt-in data, and the content of
          messages we send) will not be shared with third parties or affiliates
          for marketing or promotional purposes. We only share phone numbers
          with our SMS service provider (Twilio) to the extent strictly
          necessary to deliver the messages you have opted in to receive.
        </p>
        <p>
          <strong>How to opt out:</strong> You may stop SMS messages at any
          time by:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Replying <strong>STOP</strong> to any message you receive from us, or
          </li>
          <li>
            Removing your phone number from your CleanOS profile at{" "}
            <a className="underline" href="/profile">/profile</a> and clicking Save.
          </li>
        </ul>
        <p>
          <strong>How to get help:</strong> Reply <strong>HELP</strong> to any
          message for assistance, or email us at{" "}
          <a className="underline" href="mailto:support@turnpoint.app">
            support@turnpoint.app
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold pt-4">
          5. Legal basis for processing
        </h2>
        <p>
          We process your personal information on the following legal bases:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Performance of a contract:</strong> processing necessary to
            provide the CleanOS service to you under your work relationship
            with Ascend.
          </li>
          <li>
            <strong>Consent:</strong> SMS notifications are sent only after you
            voluntarily save your phone number and may be withdrawn at any time.
          </li>
          <li>
            <strong>Legitimate interests:</strong> securing the platform,
            preventing abuse, and improving the service.
          </li>
          <li>
            <strong>Legal obligation:</strong> as required to comply with
            applicable laws.
          </li>
        </ul>

        <h2 className="text-xl font-semibold pt-4">
          6. How we share information
        </h2>
        <p>
          We share personal information only as described below. We do not sell
          personal information.
        </p>
        <h3 className="font-semibold mt-3">a. Service providers</h3>
        <p>
          We use the following third-party processors to operate CleanOS. Each
          is contractually limited to processing your information only as
          needed to provide their service to us:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Twilio</strong> — delivers SMS messages on our behalf.
          </li>
          <li>
            <strong>Supabase</strong> — hosts our database, authentication, and
            file storage.
          </li>
          <li>
            <strong>Vercel</strong> — hosts the CleanOS web application.
          </li>
          <li>
            <strong>Hostaway</strong> — provides property listings and
            reservation data via API integration.
          </li>
          <li>
            <strong>Google (Gemini API)</strong> — when a manager uses the
            AI-assisted checklist builder, the pasted text or uploaded file is
            sent to Google's Gemini API to produce a structured checklist.
            Google's API does not use this content to train its models for our
            tier of access.
          </li>
        </ul>
        <h3 className="font-semibold mt-3">b. Legal compliance and safety</h3>
        <p>
          We may disclose information if required to do so by law, valid legal
          process (such as a subpoena or court order), or to protect the
          rights, safety, or property of Ascend, our users, or the public.
        </p>
        <h3 className="font-semibold mt-3">c. Business transfers</h3>
        <p>
          If Ascend is involved in a merger, acquisition, financing, or sale of
          assets, your information may be transferred as part of that
          transaction. We will notify users of any such change and any choices
          they may have.
        </p>

        <h2 className="text-xl font-semibold pt-4">7. Data retention</h2>
        <p>
          We retain personal information for as long as your account is active
          or as needed to provide the service. After account closure, we delete
          or de-identify personal information within a reasonable period
          (typically 90 days), except where we are required to retain it longer
          to comply with legal, tax, or accounting obligations, to resolve
          disputes, or to enforce our agreements.
        </p>

        <h2 className="text-xl font-semibold pt-4">8. Data security</h2>
        <p>
          We use industry-standard safeguards to protect your personal
          information, including TLS encryption in transit, encryption at rest
          on our hosting providers, role-based access controls enforced by
          row-level security in our database, and password hashing. No system
          is perfectly secure; we cannot guarantee absolute security but we
          continuously work to improve our protections.
        </p>

        <h2 className="text-xl font-semibold pt-4">9. Your privacy rights</h2>
        <p>You have the following rights with respect to your personal information:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Access:</strong> request a copy of the personal information
            we hold about you.
          </li>
          <li>
            <strong>Correction:</strong> ask us to fix inaccurate information.
            You can edit your name and phone number directly on your profile at{" "}
            <a className="underline" href="/profile">/profile</a>.
          </li>
          <li>
            <strong>Deletion:</strong> request that we delete your personal
            information, subject to certain legal exceptions.
          </li>
          <li>
            <strong>Withdrawal of consent:</strong> opt out of SMS at any time
            (see Section 4).
          </li>
          <li>
            <strong>Objection:</strong> object to certain processing based on
            our legitimate interests.
          </li>
          <li>
            <strong>Portability:</strong> receive a machine-readable copy of
            information you have provided.
          </li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a className="underline" href="mailto:support@turnpoint.app">
            support@turnpoint.app
          </a>
          . We will respond within 30 days.
        </p>

        <h3 className="font-semibold mt-3">a. California residents (CCPA/CPRA)</h3>
        <p>
          California residents have additional rights under the California
          Consumer Privacy Act, as amended by the CPRA: the right to know what
          personal information we collect, the right to delete it, the right to
          correct inaccurate information, the right to opt out of "sales" and
          "sharing" of personal information for cross-context behavioral
          advertising (we do not sell or share personal information for such
          purposes), and the right not to be discriminated against for
          exercising your rights.
        </p>
        <h3 className="font-semibold mt-3">b. Other US states</h3>
        <p>
          Residents of Virginia, Colorado, Connecticut, Utah, and other US
          states with comprehensive privacy laws have similar rights under
          their state laws. Contact us at the email above to exercise them.
        </p>

        <h2 className="text-xl font-semibold pt-4">10. Children's privacy</h2>
        <p>
          CleanOS is not directed to children under 16 and we do not knowingly
          collect personal information from children under 16. If you believe a
          child has provided us with personal information, please contact us
          and we will delete it.
        </p>

        <h2 className="text-xl font-semibold pt-4">11. International users</h2>
        <p>
          CleanOS is operated from the United States. If you access the service
          from outside the United States, you understand that your information
          may be transferred to, stored, and processed in the United States,
          which may have data protection laws different from those of your
          jurisdiction.
        </p>

        <h2 className="text-xl font-semibold pt-4">
          12. Cookies and similar technologies
        </h2>
        <p>
          CleanOS uses your browser's local storage to keep you signed in
          between visits and to cache a small amount of session data (such as
          your role) for performance. We do not use third-party advertising
          cookies, tracking pixels, or behavioral analytics.
        </p>

        <h2 className="text-xl font-semibold pt-4">13. Third-party links</h2>
        <p>
          CleanOS may contain links to third-party sites (such as Hostaway's
          dashboard). We are not responsible for the privacy practices of
          third-party sites; we encourage you to review their privacy policies
          separately.
        </p>

        <h2 className="text-xl font-semibold pt-4">
          14. Changes to this policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time. We will revise
          the "Last updated" date at the top of this page when we do, and for
          material changes we will provide additional notice (for example, via
          email or an in-app banner).
        </p>

        <h2 className="text-xl font-semibold pt-4">15. Contact us</h2>
        <p>
          For any questions or requests related to this Privacy Policy, please
          email{" "}
          <a className="underline" href="mailto:support@turnpoint.app">
            support@turnpoint.app
          </a>
          .
        </p>
      </section>
    </div>
  </div>
);

export default Privacy;
