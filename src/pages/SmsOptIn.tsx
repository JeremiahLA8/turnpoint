import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

// Publicly accessible proof of the SMS opt-in / consent mechanism.
//
// Why this page exists: the actual opt-in lives inside each staff member's
// authenticated Profile page (a closed business-to-employee tool). A2P 10DLC
// / TCR reviewers cannot log in to see it, which caused repeated "opt-in
// information" rejections. This page reproduces that exact consent screen at a
// public URL so the opt-in is verifiable without an account. Linked from the
// Privacy Policy and referenced in the A2P campaign registration.

const SmsOptIn = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">SMS Opt-In &amp; Consent — CleanOS</h1>
          <p className="text-sm text-muted-foreground">
            Operated by Ascend Vacation Rentals LLC, Eugene, Oregon. CleanOS is a
            closed internal tool for our own cleaning contractors and operations
            managers. The screen below is the exact consent control each staff
            member sees on their authenticated Profile page; it is reproduced
            here so the opt-in can be reviewed without an account.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">How staff opt in</h2>
          <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
            <li>Staff are hired and onboarded by Ascend (an active work relationship).</li>
            <li>They sign in to CleanOS with company-issued credentials.</li>
            <li>On their Profile page they enter their personal mobile number.</li>
            <li>
              They must <strong>actively check the consent box</strong> shown below.
              No box checked = no texts are ever sent.
            </li>
          </ol>
        </section>

        {/* Visual replica of the in-app consent control (non-functional). */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">The consent screen staff see</h2>
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div>
              <Label htmlFor="demo_phone">Phone</Label>
              <div className="relative">
                <Input
                  id="demo_phone"
                  value="(541) 555-0142"
                  readOnly
                  className="pr-9"
                />
                <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex gap-3">
                <Checkbox id="demo_consent" checked className="mt-0.5" />
                <Label
                  htmlFor="demo_consent"
                  className="text-xs font-normal leading-relaxed text-muted-foreground"
                >
                  I agree to receive operational SMS text messages from{" "}
                  <span className="font-medium text-foreground">
                    Ascend Vacation Rentals (CleanOS)
                  </span>{" "}
                  about job assignments, schedule changes, reminders, and
                  completion confirmations at the mobile number above. Message
                  frequency varies. Message and data rates may apply. Reply{" "}
                  <strong>STOP</strong> to opt out, <strong>HELP</strong> for
                  help. See our{" "}
                  <Link to="/terms" className="underline hover:text-foreground">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="underline hover:text-foreground">
                    Privacy Policy
                  </Link>
                  .
                </Label>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2 text-sm text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Program details</h2>
          <p><strong>Program name:</strong> CleanOS Operational Notifications.</p>
          <p><strong>Program sponsor:</strong> Ascend Vacation Rentals LLC.</p>
          <p>
            <strong>Message types:</strong> job assignments, schedule changes,
            reminders, completion confirmations, and daily 7:00am Pacific
            summaries of unassigned jobs (managers only).
          </p>
          <p>
            <strong>Message frequency:</strong> varies with operational activity,
            typically 1–10 messages per week per recipient.
          </p>
          <p><strong>Message and data rates may apply.</strong></p>
          <p>
            <strong>Opt out:</strong> reply STOP to any message, or uncheck the
            consent box in your Profile, at any time.
          </p>
          <p>
            <strong>Help:</strong> reply HELP, or email support via Ascend
            Vacation Rentals.
          </p>
          <p>
            <strong>Privacy:</strong> mobile numbers and opt-in data are never
            sold or shared with third parties for marketing; they are shared only
            with our SMS provider (Twilio) to deliver the messages above. See our{" "}
            <Link to="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <footer className="pt-4 text-sm">
          <Link to="/" className="text-primary underline">
            ← Back to CleanOS
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default SmsOptIn;
