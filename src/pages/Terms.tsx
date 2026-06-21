const LAST_UPDATED = "May 21, 2026";

const Terms = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Last updated: {LAST_UPDATED}
      </p>

      <section className="space-y-5 text-sm leading-relaxed">
        <p>
          These Terms and Conditions ("Terms") govern your access to and use of
          CleanOS, an internal operations platform provided by Ascend Vacation
          Rentals LLC ("Ascend," "we," "us," or "our") to coordinate cleaning
          work at properties Ascend manages. By creating a CleanOS account or
          otherwise using the service, you agree to these Terms and to our{" "}
          <a className="underline" href="/privacy">Privacy Policy</a>. If you do
          not agree, do not use CleanOS.
        </p>

        <h2 className="text-xl font-semibold pt-4">1. Eligibility</h2>
        <p>
          CleanOS is provided to staff, contractors, authorized representatives
          of Ascend, and to property owners whose properties Ascend manages.
          You must be at least 18 years old to use the service. By using
          CleanOS, you represent and warrant that you meet these eligibility
          requirements.
        </p>

        <h2 className="text-xl font-semibold pt-4">2. Your account</h2>
        <p>
          You are responsible for safeguarding your login credentials and for
          all activity that occurs under your account. You agree to:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Provide accurate information (including your real name and a
            mobile phone number you personally control if you choose to enroll
            in SMS notifications).
          </li>
          <li>Keep your account information current.</li>
          <li>
            Use a strong, unique password and not share it with any other person.
          </li>
          <li>
            Notify us immediately at{" "}
            <a className="underline" href="mailto:support@turnpoint.app">
              support@turnpoint.app
            </a>{" "}
            if you believe your account has been compromised.
          </li>
        </ul>
        <p>
          We may suspend or terminate your account if you violate these Terms
          or if your work relationship with Ascend ends.
        </p>

        <h2 className="text-xl font-semibold pt-4">3. Acceptable use</h2>
        <p>While using CleanOS you agree not to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Use CleanOS for any purpose other than coordinating legitimate
            cleaning operations under your assigned role.
          </li>
          <li>
            Access data, jobs, or accounts you are not authorized to access.
          </li>
          <li>
            Upload content that is unlawful, infringing, harassing, or harmful
            (including images that depict identifiable third parties without
            their consent).
          </li>
          <li>
            Attempt to disrupt, reverse-engineer, or circumvent the security or
            operation of CleanOS, our APIs, or our infrastructure providers.
          </li>
          <li>
            Use automated tools (scrapers, bots, etc.) to access CleanOS except
            via APIs we explicitly publish.
          </li>
          <li>
            Misrepresent your identity or your relationship with Ascend.
          </li>
        </ul>

        <h2 className="text-xl font-semibold pt-4">4. SMS program</h2>
        <p>
          <strong>Program name:</strong> CleanOS Operational Notifications.
        </p>
        <p>
          <strong>Program sponsor:</strong> Ascend Vacation Rentals LLC.
        </p>
        <p>
          <strong>Description:</strong> When you add a mobile phone number to
          your CleanOS profile, you consent to receive operational SMS messages
          from Ascend related to cleaning work assigned to you. This is a
          closed business-to-employee (B2E) program; only existing contractors,
          employees, and managers with an active work relationship with Ascend
          may opt in. Message types include:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Job assignment confirmations</li>
          <li>Schedule change alerts</li>
          <li>Completion confirmations (sent to managers)</li>
          <li>
            Daily 7:00am Pacific summaries of unassigned jobs (sent to managers)
          </li>
        </ul>
        <p>
          <strong>Frequency:</strong> Message frequency varies based on
          operational activity at the properties you are assigned to. Typical
          recipients receive 1–10 messages per week. There is no fixed monthly
          cap.
        </p>
        <p>
          <strong>Cost:</strong>{" "}
          <strong>Message and data rates may apply.</strong> Ascend does not
          charge for the messages themselves; standard rates from your mobile
          carrier apply.
        </p>
        <p>
          <strong>How to opt out:</strong> Reply <strong>STOP</strong> to any
          message you receive from this program to immediately unsubscribe and
          stop all further messages. You may also remove your phone number
          from your CleanOS profile to stop receiving messages.
        </p>
        <p>
          <strong>How to get help:</strong> Reply <strong>HELP</strong> to any
          message for assistance, or email{" "}
          <a className="underline" href="mailto:support@turnpoint.app">
            support@turnpoint.app
          </a>
          .
        </p>
        <p>
          <strong>No third-party sharing.</strong> Mobile information
          (including phone numbers and opt-in consent records) will not be
          shared with third parties or affiliates for marketing or promotional
          purposes. Mobile opt-in data and consent will not be shared with any
          third party for marketing.
        </p>
        <p>
          <strong>Supported carriers:</strong> All major US carriers (AT&amp;T,
          T-Mobile, Verizon, and others). Carriers are not liable for delayed
          or undelivered messages.
        </p>

        <h2 className="text-xl font-semibold pt-4">5. Service availability</h2>
        <p>
          We work to keep CleanOS available and reliable, but we provide the
          service on an "as is" and "as available" basis. We may modify,
          suspend, or discontinue the service (or any feature) at any time,
          with or without notice. We are not liable to you or any third party
          for any modification, suspension, or discontinuation of the service.
        </p>

        <h2 className="text-xl font-semibold pt-4">6. Your content</h2>
        <p>
          You may upload content to CleanOS, including photos of properties you
          are cleaning and notes describing your work ("Your Content"). You
          retain ownership of Your Content, but by uploading it you grant
          Ascend a non-exclusive, worldwide, royalty-free license to host,
          store, display, and process Your Content as needed to operate
          CleanOS and to share it within Ascend's internal team and with the
          property owners whose properties the content relates to.
        </p>
        <p>
          You represent that you have the right to upload Your Content and
          that doing so does not violate the privacy or other rights of any
          third party (for example, do not upload photos that clearly identify
          a guest's personal belongings without legitimate operational
          purpose).
        </p>

        <h2 className="text-xl font-semibold pt-4">7. Intellectual property</h2>
        <p>
          CleanOS, including all software, design, text, graphics, and
          trademarks, is owned by Ascend or its licensors and is protected by
          copyright, trademark, and other intellectual property laws. We grant
          you a limited, non-exclusive, non-transferable, revocable license to
          access and use CleanOS solely for the purposes described in Section
          3. We reserve all rights not expressly granted.
        </p>

        <h2 className="text-xl font-semibold pt-4">8. Third-party services</h2>
        <p>
          CleanOS integrates with third-party services (including Twilio,
          Supabase, Vercel, Hostaway, and Google). Your use of those services
          through CleanOS is also subject to their respective terms and
          privacy policies. We are not responsible for the practices, content,
          or availability of third-party services.
        </p>

        <h2 className="text-xl font-semibold pt-4">9. Privacy</h2>
        <p>
          Your use of CleanOS is governed by our{" "}
          <a className="underline" href="/privacy">Privacy Policy</a>, which
          explains what data we collect and how we use it.
        </p>

        <h2 className="text-xl font-semibold pt-4">10. Disclaimers</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CLEANOS IS
          PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES
          OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION THE
          IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
          WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES.
          OPERATIONAL SMS NOTIFICATIONS ARE BEST-EFFORT; CARRIERS MAY DELAY OR
          FAIL TO DELIVER MESSAGES, AND ASCEND IS NOT RESPONSIBLE FOR ANY
          RESULTING IMPACT.
        </p>

        <h2 className="text-xl font-semibold pt-4">
          11. Limitation of liability
        </h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL ASCEND, ITS
          OFFICERS, EMPLOYEES, OR CONTRACTORS BE LIABLE TO YOU FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT
          OF OR IN CONNECTION WITH YOUR USE OF CLEANOS, EVEN IF WE HAVE BEEN
          ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO
          YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE SHALL
          NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU HAVE PAID US TO USE
          CLEANOS IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED
          US DOLLARS ($100).
        </p>

        <h2 className="text-xl font-semibold pt-4">12. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Ascend, its officers,
          employees, and contractors from and against any claim, loss, or
          expense (including reasonable attorneys' fees) arising out of (a)
          your use of CleanOS in violation of these Terms or applicable law,
          (b) Your Content, or (c) your violation of any rights of a third
          party.
        </p>

        <h2 className="text-xl font-semibold pt-4">13. Termination</h2>
        <p>
          You may stop using CleanOS at any time. We may suspend or terminate
          your access immediately, with or without notice, if we reasonably
          believe you have violated these Terms or applicable law, or if your
          work relationship with Ascend ends. Sections that by their nature
          should survive termination (including Sections 6, 7, 10–14, and 16)
          will survive.
        </p>

        <h2 className="text-xl font-semibold pt-4">14. Governing law</h2>
        <p>
          These Terms are governed by the laws of the State of Oregon, USA,
          without regard to its conflict-of-laws principles. You and Ascend
          agree that any action arising out of or relating to these Terms or
          your use of CleanOS shall be brought exclusively in the state or
          federal courts located in Lane County, Oregon, and you consent to
          the personal jurisdiction of those courts.
        </p>

        <h2 className="text-xl font-semibold pt-4">15. Changes to these Terms</h2>
        <p>
          We may revise these Terms from time to time. We will update the
          "Last updated" date at the top of this page when we do. For material
          changes we will provide additional notice (for example, via email or
          an in-app banner). Your continued use of CleanOS after a change
          constitutes acceptance of the revised Terms.
        </p>

        <h2 className="text-xl font-semibold pt-4">16. Miscellaneous</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Entire agreement:</strong> these Terms and the Privacy
            Policy constitute the entire agreement between you and Ascend
            regarding CleanOS.
          </li>
          <li>
            <strong>Severability:</strong> if any provision of these Terms is
            held invalid, the remaining provisions will continue in full force.
          </li>
          <li>
            <strong>No waiver:</strong> our failure to enforce any right or
            provision of these Terms will not be deemed a waiver.
          </li>
          <li>
            <strong>Assignment:</strong> you may not assign these Terms
            without our prior written consent; we may assign them to an
            affiliate or successor without restriction.
          </li>
        </ul>

        <h2 className="text-xl font-semibold pt-4">17. Contact</h2>
        <p>
          Questions about these Terms? Email{" "}
          <a className="underline" href="mailto:support@turnpoint.app">
            support@turnpoint.app
          </a>
          .
        </p>
      </section>
    </div>
  </div>
);

export default Terms;
