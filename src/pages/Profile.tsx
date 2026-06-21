import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizePhone, formatUsPhone } from "@/lib/phone";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  sms_consent_at: string | null;
};

// Verbatim consent disclosure shown at opt-in and recorded to
// profiles.sms_consent_text. Keep in sync with the A2P 10DLC campaign
// registration. CTIA-required elements: program/brand, message types,
// frequency, rates, opt-out, and links to Terms + Privacy.
export const SMS_CONSENT_TEXT =
  "I agree to receive operational SMS text messages from Ascend Vacation Rentals " +
  "(CleanOS) about job assignments, schedule changes, reminders, and completion " +
  "confirmations at the mobile number I provided. Message frequency varies. " +
  "Message and data rates may apply. Reply STOP to opt out, HELP for help. " +
  "See the Terms of Service and Privacy Policy.";

const profileQueryKey = (id: string) => ["profile", id] as const;

const Profile = () => {
  const { user, roles } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: profileQueryKey(user?.id ?? ""),
    enabled: !!user,
    queryFn: async (): Promise<ProfileRow | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, sms_consent_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setSmsConsent(!!profile.sms_consent_at);
    }
  }, [profile]);

  const phoneValid = normalizePhone(phone) !== null;
  // Consent is meaningless without a deliverable number; force it off.
  const effectiveConsent = smsConsent && phoneValid;

  const initials = (fullName || user?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Store the number in E.164 when valid so consent matching in the
      // send-sms function is exact; otherwise keep the raw text.
      const normalized = normalizePhone(phone);
      const phoneToSave = normalized ?? (phone.trim() || null);

      // Stamp consent the first time it's granted; preserve the original
      // timestamp on subsequent saves; clear it (and the recorded text) on
      // opt-out or if the number is removed/invalid.
      const consentPatch = effectiveConsent
        ? {
            sms_consent_at: profile?.sms_consent_at ?? new Date().toISOString(),
            sms_consent_text: SMS_CONSENT_TEXT,
          }
        : { sms_consent_at: null, sms_consent_text: null };

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phoneToSave,
          ...consentPatch,
        })
        .eq("id", user.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: profileQueryKey(user.id) });
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl bg-card border border-border rounded-xl p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-bold">{fullName || user?.email || "Profile"}</h2>
          <p className="text-sm text-muted-foreground">{roles.join(", ") || "—"}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
          <PhoneField phone={phone} onChange={setPhone} />

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex gap-3">
              <Checkbox
                id="sms_consent"
                checked={smsConsent}
                disabled={!phoneValid}
                onCheckedChange={(v) => setSmsConsent(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="sms_consent"
                className="text-xs font-normal leading-relaxed text-muted-foreground cursor-pointer"
              >
                I agree to receive operational SMS text messages from{" "}
                <span className="font-medium text-foreground">Ascend Vacation Rentals (CleanOS)</span>{" "}
                about job assignments, schedule changes, reminders, and completion
                confirmations at the mobile number above. Message frequency varies.
                Message and data rates may apply. Reply <strong>STOP</strong> to opt out,{" "}
                <strong>HELP</strong> for help. See our{" "}
                <Link to="/terms" target="_blank" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" target="_blank" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>
                .
              </Label>
            </div>
            {!phoneValid && (
              <p className="text-[11px] text-muted-foreground mt-2 pl-7">
                Enter a valid mobile number above to enable text notifications.
              </p>
            )}
            {profile?.sms_consent_at && smsConsent && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 pl-7">
                Opted in on {new Date(profile.sms_consent_at).toLocaleDateString()}.
              </p>
            )}
          </div>

          <Button className="rounded-full" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
};

function PhoneField({
  phone,
  onChange,
}: {
  phone: string;
  onChange: (next: string) => void;
}) {
  const validation = useMemo(() => {
    const trimmed = phone.trim();
    if (!trimmed) return { state: "empty" as const, e164: null as string | null };
    const e164 = normalizePhone(trimmed);
    return e164
      ? { state: "valid" as const, e164 }
      : { state: "invalid" as const, e164: null };
  }, [phone]);

  return (
    <div>
      <Label htmlFor="phone">Phone</Label>
      <div className="relative">
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => onChange(e.target.value)}
          placeholder="(555) 123-4567"
          className="pr-9"
          aria-invalid={validation.state === "invalid"}
        />
        {validation.state === "valid" && (
          <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
        )}
        {validation.state === "invalid" && (
          <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
        )}
      </div>
      {validation.state === "valid" && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
          Will send to <code>{formatUsPhone(validation.e164) || validation.e164}</code>
        </p>
      )}
      {validation.state === "invalid" && (
        <p className="text-[11px] text-destructive mt-1">
          Not a valid US phone number. Use 10 digits (e.g. 555-123-4567) or +country format.
        </p>
      )}
    </div>
  );
}

export default Profile;
