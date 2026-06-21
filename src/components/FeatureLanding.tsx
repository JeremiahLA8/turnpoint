import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Feat = { icon: LucideIcon; text: string };

export const FeatureLanding = ({
  title, body, ctaLabel, footerTitle, features,
}: {
  title: string; body: string; ctaLabel: string; footerTitle: string; features: Feat[];
}) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden w-full max-w-5xl mx-auto">
    <div className="p-6 sm:p-12 text-center">
      <h2 className="text-3xl font-bold tracking-tight max-w-2xl mx-auto mb-6">{title}</h2>
      <p className="text-muted-foreground max-w-2xl mx-auto mb-8">{body}</p>
      <Button size="lg" className="rounded-full">{ctaLabel}</Button>
    </div>
    <div className="bg-secondary/40 border-t border-border p-6 sm:p-10">
      <h3 className="text-center font-bold mb-8">{footerTitle}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
        {features.map((f, i) => (
          <div key={i} className="text-center">
            <f.icon className="h-8 w-8 mx-auto mb-3 text-primary" />
            <p className="text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);
