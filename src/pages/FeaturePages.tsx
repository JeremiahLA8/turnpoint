import { FeatureLanding } from "@/components/FeatureLanding";
import { EmptyState } from "@/components/EmptyState";
import { Star, DollarSign, Search, KeyRound, Sparkles, BarChart3, Package, Calendar, Users } from "lucide-react";

export const QualityCenter = () => (
  <FeatureLanding
    title="5-Star Performance Bonus to help you improve your properties' Airbnb rating"
    body="Incentivize your teammates with an automatic bonus payment whenever a guest leaves a 5-star cleanliness rating on Airbnb."
    ctaLabel="Get Started with Performance Bonus"
    footerTitle="Use Performance Bonus to"
    features={[
      { icon: Star, text: "Incentivize your teammates to get a better review" },
      { icon: DollarSign, text: "Reward your teammates for their exceptional service" },
    ]}
  />
);

export const CleanerSearch = () => (
  <EmptyState icon={Search} title="No active cleaner searches"
    body="Post a project on the marketplace to find vetted cleaners in your area."
    ctaLabel="Search the Marketplace" />
);

export const CheckIn = () => (
  <FeatureLanding
    title="Streamline check-in & welcoming for every guest"
    body="Automate guest communication, share property guides, and confirm arrivals from one place."
    ctaLabel="Get Started"
    footerTitle="Use Check-in to"
    features={[
      { icon: KeyRound, text: "Send custom check-in instructions" },
      { icon: Users, text: "Coordinate with greeters" },
      { icon: Sparkles, text: "Track guest arrival timing" },
      { icon: Star, text: "Capture guest feedback early" },
    ]}
  />
);

export const Inventory = () => (
  <EmptyState icon={Package} title="You don't have any items on the inventory"
    body="Inventories are great to ensure nothing is missing for your next guest."
    ctaLabel="Add an item to the Inventory" />
);

export const GuestCenter = () => (
  <FeatureLanding
    title="Delight every guest with a polished welcome"
    body="Centralize property guides, Wi-Fi details, local recommendations and house rules."
    ctaLabel="Set up Guest Center"
    footerTitle="Use Guest Center to"
    features={[
      { icon: Sparkles, text: "Share local recommendations" },
      { icon: KeyRound, text: "Provide check-in info" },
      { icon: Star, text: "Collect direct reviews" },
      { icon: Sparkles, text: "Reduce repetitive guest questions" },
    ]}
  />
);

export const HostServices = () => (
  <FeatureLanding
    title="Premium host services on demand"
    body="From photography to listing optimization, get expert help to grow your bookings."
    ctaLabel="Browse Services"
    footerTitle="Use Host Services to"
    features={[
      { icon: BarChart3, text: "Listing optimization" },
      { icon: Sparkles, text: "Professional photography" },
      { icon: Calendar, text: "Pricing strategy" },
      { icon: Users, text: "Concierge management" },
    ]}
  />
);
