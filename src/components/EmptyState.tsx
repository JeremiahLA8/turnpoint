import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const EmptyState = ({
  icon: Icon, title, body, ctaLabel, onCta,
}: { icon: LucideIcon; title: string; body?: string; ctaLabel?: string; onCta?: () => void }) => (
  <div className="bg-card border border-border rounded-xl p-8 sm:p-16 text-center w-full max-w-5xl mx-auto">
    <Icon className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
    <h3 className="font-bold text-lg mb-2">{title}</h3>
    {body && <p className="text-muted-foreground max-w-md mx-auto mb-6">{body}</p>}
    {ctaLabel && <Button onClick={onCta} className="rounded-full">{ctaLabel}</Button>}
  </div>
);
