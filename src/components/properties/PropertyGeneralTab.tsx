import { useState } from "react";
import { type Property, useUpdateProperty } from "@/lib/api/properties";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, X, MapPin, Wifi, KeyRound, Palette, Globe, DollarSign } from "lucide-react";

const TIMEZONES = [
  "(GMT-10:00) Hawaii",
  "(GMT-08:00) Pacific Time (US)",
  "(GMT-07:00) Mountain Time (US)",
  "(GMT-06:00) Central Time (US)",
  "(GMT-05:00) Eastern Time (US)",
  "(GMT+00:00) UTC",
  "(GMT+01:00) Central European Time",
];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "MXN"];
const COLORS = [
  "bg-sky-300", "bg-emerald-300", "bg-fuchsia-300", "bg-pink-300",
  "bg-rose-300", "bg-yellow-300", "bg-lime-300", "bg-orange-300",
  "bg-violet-300", "bg-teal-300",
];

export const PropertyGeneralTab = ({ property }: { property: Property }) => {
  const { toast } = useToast();
  const updateProperty = useUpdateProperty();
  const [form, setForm] = useState({
    name: property.name,
    alias: property.nickname ?? property.name,
    address: property.address,
    addressUnknown: false,
    unit: "",
    accessCode: property.access_notes ?? "",
    city: "Eugene",
    state: "Oregon",
    country: "United States",
    zip: "97402",
    timezone: "(GMT-08:00) Pacific Time (US)",
    currency: "USD",
    color: property.color.split(" ")[0] ?? "bg-sky-300",
    guests: property.guests,
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
    sizeUnit: "sqft" as "sqft" | "sqm",
    sizeUnknown: property.sqft === 0,
    wifiName: "",
    wifiPassword: "",
    wifiNone: false,
    description: `${property.address}`,
    petsAllowed: false,
    smokingAllowed: false,
    parking: "street" as "none" | "street" | "driveway" | "garage",
  });
  const [photos, setPhotos] = useState<string[]>([]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addPhoto = () => setPhotos((p) => [...p, `Photo ${p.length + 1}`]);
  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  // Convert sqm input to sqft for storage when user picks sqm
  const sqftForStorage = () => {
    if (form.sizeUnknown) return 0;
    return form.sizeUnit === "sqm" ? Math.round(form.sqft * 10.7639) : form.sqft;
  };

  const handleSave = async () => {
    try {
      await updateProperty.mutateAsync({
        id: property.id,
        patch: {
          name: form.name.trim() || property.name,
          nickname: form.alias.trim() || null,
          address: form.address,
          beds: Number(form.beds) || 0,
          baths: Number(form.baths) || 0,
          guests: Number(form.guests) || 0,
          sqft: sqftForStorage(),
          access_notes: form.accessCode.trim() || null,
        },
      });
      toast({ title: "Property updated", description: form.name });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Identity & location */}
      <Section title="Identity & location" icon={<MapPin className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Property name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Alias (internal)">
            <Input value={form.alias} onChange={(e) => set("alias", e.target.value)} />
          </Field>
          <Field label="Street address" className="md:col-span-2">
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              disabled={form.addressUnknown}
            />
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={form.addressUnknown} onCheckedChange={(v) => set("addressUnknown", !!v)} />
              I can't find my address
            </label>
          </Field>
          <Field label="Unit / building">
            <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="Unit #, Building, etc" />
          </Field>
          <Field label="Access code">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-9"
                maxLength={255}
                value={form.accessCode}
                onChange={(e) => set("accessCode", e.target.value)}
                placeholder="Gate / door code"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">
                {form.accessCode.length}/255
              </span>
            </div>
          </Field>
          <Field label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="State / region"><Input value={form.state} onChange={(e) => set("state", e.target.value)} /></Field>
          <Field label="Country"><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
          <Field label="Zip / postal code"><Input value={form.zip} onChange={(e) => set("zip", e.target.value)} /></Field>
        </div>
      </Section>

      {/* Photos */}
      <Section title="Photos">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((label, i) => (
            <div key={i} className="relative aspect-square rounded-lg bg-secondary border border-border flex items-center justify-center">
              <span className="text-xs text-muted-foreground">{label}</span>
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 hover:bg-background border border-border inline-flex items-center justify-center"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={addPhoto}
            className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/40 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-xs">Add photo</span>
          </button>
        </div>
      </Section>

      {/* Branding & locale */}
      <Section title="Branding & locale" icon={<Palette className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Property color" className="md:col-span-1">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  className={cn(
                    "h-8 w-8 rounded-md border-2 transition-all",
                    c,
                    form.color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  aria-label={c}
                />
              ))}
            </div>
          </Field>
          <Field label="Timezone">
            <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
              <SelectTrigger><Globe className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger><DollarSign className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      {/* Capacity */}
      <Section title="Capacity & size">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Bedrooms">
            <Input type="number" min={0} value={form.beds} onChange={(e) => set("beds", Number(e.target.value))} />
          </Field>
          <Field label="Beds">
            <Input type="number" min={0} value={form.beds} onChange={(e) => set("beds", Number(e.target.value))} />
          </Field>
          <Field label="Bathrooms">
            <Input type="number" min={0} step={0.5} value={form.baths} onChange={(e) => set("baths", Number(e.target.value))} />
          </Field>
          <Field label="Max guests">
            <Input type="number" min={1} value={form.guests} onChange={(e) => set("guests", Number(e.target.value))} />
          </Field>
          <Field label="Unit size" className="md:col-span-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={form.sqft}
                onChange={(e) => set("sqft", Number(e.target.value))}
                disabled={form.sizeUnknown}
                className="flex-1"
              />
              <div className="inline-flex rounded-md border border-border overflow-hidden shrink-0">
                {(["sqft", "sqm"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => set("sizeUnit", u)}
                    className={cn(
                      "px-3 h-9 text-xs font-medium",
                      form.sizeUnit === u ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                    )}
                  >
                    {u === "sqft" ? "sq ft" : "sq m"}
                  </button>
                ))}
              </div>
            </div>
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={form.sizeUnknown} onCheckedChange={(v) => set("sizeUnknown", !!v)} />
              I don't know the unit size
            </label>
          </Field>
          <Field label="Parking" className="md:col-span-2">
            <Select value={form.parking} onValueChange={(v) => set("parking", v as typeof form.parking)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="street">Street parking</SelectItem>
                <SelectItem value="driveway">Driveway</SelectItem>
                <SelectItem value="garage">Garage</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={form.petsAllowed} onCheckedChange={(v) => set("petsAllowed", !!v)} />
            Pets allowed
          </label>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={form.smokingAllowed} onCheckedChange={(v) => set("smokingAllowed", !!v)} />
            Smoking allowed
          </label>
        </div>
      </Section>

      {/* Wi-Fi */}
      <Section title="Wi-Fi (visible to teammates)" icon={<Wifi className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Network name">
            <Input value={form.wifiName} onChange={(e) => set("wifiName", e.target.value)} placeholder="SSID" />
          </Field>
          <Field label="Password">
            <Input
              value={form.wifiPassword}
              onChange={(e) => set("wifiPassword", e.target.value)}
              disabled={form.wifiNone}
              placeholder="••••••••"
            />
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={form.wifiNone} onCheckedChange={(v) => set("wifiNone", !!v)} />
              No password required
            </label>
          </Field>
        </div>
      </Section>

      {/* Description */}
      <Section title="Description (visible to teammates)">
        <Textarea
          rows={4}
          maxLength={1000}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Internal notes, special handling, quirks…"
        />
        <div className="text-right text-[10px] font-mono text-muted-foreground mt-1">
          {form.description.length}/1000
        </div>
      </Section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateProperty.isPending}>
          {updateProperty.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {updateProperty.isPending ? "Saving…" : "Update property"}
        </Button>
      </div>
    </div>
  );
};

const Section = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="bg-card border border-border rounded-xl p-6">
    <h2 className="font-bold mb-4 inline-flex items-center gap-2">
      {icon}
      {title}
    </h2>
    {children}
  </section>
);

const Field = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">{label}</Label>
    {children}
  </div>
);
