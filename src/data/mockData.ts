// Demo data for the Turnpoint showcase build.
// All people, properties, addresses, and payment details below are fictional.

export const currentUser = {
  name: "Jordan Avery",
  initials: "JA",
  role: "Property Manager",
};

export const kpis = [
  { label: "PROJECTS TODAY", value: 0, key: "today", info: "Cleaning and maintenance projects scheduled to take place today across all properties." },
  { label: "NEXT 7 DAYS", value: 7, key: "week", info: "Total projects scheduled in the upcoming 7 days. Helps you plan staffing and supplies." },
  { label: "NEXT 30 DAYS", value: 21, key: "month", info: "Projects on the books over the next 30 days, including recurring turnovers and inspections." },
  { label: "UNSCHEDULED", value: 4, key: "unscheduled", danger: true, info: "Projects created and assigned to a cleaner but not yet accepted. These need follow-up." },
];

export type Property = {
  id: string;
  name: string;
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  guests: number;
  teammate: string;
  completion: number;
  color: string;
};

export const properties: Property[] = [
  { id: "p1", name: "Desert View Villa", address: "742 Mesa Verde Dr, Scottsdale, AZ", beds: 7, baths: 2, sqft: 1075, guests: 3, teammate: "Grace", completion: 88, color: "bg-sky-300 text-sky-950" },
  { id: "p2", name: "Riverbend Lodge · Hot Tub · Game Room · Family Ready", address: "Portland, OR", beds: 6, baths: 4, sqft: 2400, guests: 5, teammate: "Maria", completion: 100, color: "bg-fuchsia-300 text-fuchsia-950" },
  { id: "p3", name: "Creekside Modern · Hot Tub · Creek Views · Sleeps 8", address: "512 Maple Ave, Bend, OR", beds: 2, baths: 1, sqft: 1100, guests: 3, teammate: "Maria", completion: 100, color: "bg-emerald-300 text-emerald-950" },
  { id: "p4", name: "Birch Street House", address: "330 Birch St, Salem, OR", beds: 7, baths: 3, sqft: 2750, guests: 4, teammate: "Diana", completion: 95, color: "bg-pink-300 text-pink-950" },
  { id: "p5", name: "Cedar Loop Loft", address: "88 Cedar Loop, Corvallis, OR", beds: 5, baths: 2.5, sqft: 2473, guests: 4, teammate: "Maria and Diana", completion: 80, color: "bg-rose-300 text-rose-950" },
  { id: "p6", name: "Hilltop Hideaway w Hot Tub & Fire Pit", address: "204 Summit Way, Medford, OR", beds: 6, baths: 4.5, sqft: 3067, guests: 5, teammate: "Maria and Owen", completion: 92, color: "bg-yellow-300 text-yellow-950" },
  { id: "p7", name: "Peaceful Woodland Retreat", address: "Bend, OR", beds: 4, baths: 2, sqft: 1800, guests: 6, teammate: "Maria", completion: 70, color: "bg-lime-300 text-lime-950" },
  { id: "p8", name: "Vineyard Country Home", address: "Paso Robles, CA", beds: 5, baths: 3, sqft: 2200, guests: 8, teammate: "Talia", completion: 60, color: "bg-orange-300 text-orange-950" },
];

export type ProblemQuote = { amount: number; note: string };

export type Problem = {
  id: string;
  title: string;
  description: string;
  images: string[];
  quote?: ProblemQuote;
  property: string;
  reporter: string;
  date: string;
  time: string;
  status: "unresolved" | "solved";
  ticketId: string;
  color: string;
};

export const problems: Problem[] = [
  {
    id: "pr1",
    title: "Broken blind",
    description: "The blind in the primary bedroom is snapped at the middle slat and won't roll up. Guests likely yanked the cord.",
    images: [
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=70",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=70",
    ],
    quote: { amount: 85, note: "My handyman can swap the blind out next visit — parts + 30 min labor." },
    property: "Riverbend Lodge · Hot Tub · Game Room · Family Ready",
    reporter: "Maria Delgado",
    date: "May 2, 2026",
    time: "2:01 PM",
    status: "unresolved",
    ticketId: "1777633",
    color: "bg-fuchsia-400",
  },
  {
    id: "pr2",
    title: "White chairs and duvets stained",
    description: "Two dining chairs and the master duvet have red wine stains that won't come out with normal cleaning.",
    images: ["https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=70"],
    property: "Hilltop Hideaway w Hot Tub & Fire Pit",
    reporter: "Maria Delgado",
    date: "April 30, 2026",
    time: "4:42 PM",
    status: "unresolved",
    ticketId: "1775230",
    color: "bg-success",
  },
  {
    id: "pr3",
    title: "Twin bed frame cracked",
    description: "Side rail on the upstairs twin bed is cracked. Still usable but needs replacement before next stay.",
    images: [],
    quote: { amount: 140, note: "Can pick up a replacement frame and assemble it." },
    property: "Hilltop Hideaway w Hot Tub & Fire Pit",
    reporter: "Maria Delgado",
    date: "March 26, 2026",
    time: "12:37 PM",
    status: "unresolved",
    ticketId: "1721082",
    color: "bg-success",
  },
  {
    id: "pr5",
    title: "Dishwasher not draining",
    description: "Standing water in the bottom of the dishwasher after a full cycle. May be a clogged drain hose.",
    images: [],
    property: "Birch Street House",
    reporter: "Diana Park",
    date: "March 12, 2026",
    time: "3:30 PM",
    status: "solved",
    ticketId: "1701443",
    color: "bg-muted-foreground",
  },
];

export type ScheduleStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export type ScheduleItem = {
  day: number; // 0=Sun..6=Sat
  cleaner: string;
  amount: string;
  start: string;
  end: string;
  color: string;
  property: string;
  status: ScheduleStatus;
  notes: string;
};

export const scheduleItems: ScheduleItem[] = [
  { day: 0, cleaner: "Talia Brooks", amount: "$300.00", start: "11:56 AM", end: "5:09 PM", color: "bg-orange-300 text-orange-950", property: "Vineyard Country Home", status: "scheduled", notes: "" },
  { day: 0, cleaner: "Diana Park", amount: "$200.00", start: "3:51 PM", end: "6:32 PM", color: "bg-pink-300 text-pink-950", property: "Birch Street House", status: "scheduled", notes: "" },
  { day: 0, cleaner: "Maria Delgado", amount: "$265.00", start: "4:11 PM", end: "9:47 PM", color: "bg-rose-300 text-rose-950", property: "Cedar Loop Loft", status: "scheduled", notes: "" },
  { day: 1, cleaner: "Maria Delgado", amount: "$350.00", start: "10:07 AM", end: "5:31 PM", color: "bg-yellow-300 text-yellow-950", property: "Hilltop Hideaway", status: "in_progress", notes: "" },
  { day: 1, cleaner: "Maria Delgado", amount: "$185.00", start: "1:41 PM", end: "8:04 PM", color: "bg-fuchsia-300 text-fuchsia-950", property: "Riverbend Lodge", status: "scheduled", notes: "" },
  { day: 3, cleaner: "Talia Brooks", amount: "$300.00", start: "11:34 AM", end: "5:55 PM", color: "bg-orange-300 text-orange-950", property: "Vineyard Country Home", status: "scheduled", notes: "" },
  { day: 3, cleaner: "Diana Park", amount: "$200.00", start: "11:09 AM", end: "2:26 PM", color: "bg-pink-300 text-pink-950", property: "Birch Street House", status: "completed", notes: "Guest left early — extra deep clean done." },
  { day: 4, cleaner: "Maria Delgado", amount: "$350.00", start: "10:08 AM", end: "2:37 PM", color: "bg-emerald-400 text-emerald-950", property: "Creekside Modern · Creek Views", status: "scheduled", notes: "" },
  { day: 6, cleaner: "Maria Delgado", amount: "$185.00", start: "10:52 AM", end: "2:18 PM", color: "bg-fuchsia-300 text-fuchsia-950", property: "Riverbend Lodge", status: "scheduled", notes: "" },
];

export const teammates = [
  { id: "t1", name: "Maria Delgado", initials: "MD", role: "Cleaning, Inspection", rating: 5.0, primary: ["Hilltop Hideaway", "Cedar Loop Loft"], connected: "Jan 21, 2026", marketplace: true },
  { id: "t2", name: "Paula Bennett", initials: "PB", role: "Cleaning", rating: 4.8, primary: [], connected: "Nov 17, 2025", marketplace: false },
  { id: "t3", name: "Nina Okafor", initials: "NO", role: "Cleaning", rating: 4.9, primary: [], connected: "Jul 05, 2025", marketplace: false },
  { id: "t4", name: "Grace Holloway", initials: "GH", role: "Cleaning", rating: 5.0, primary: ["Desert View Villa"], connected: "May 01, 2026", marketplace: true },
  { id: "t5", name: "Diana Park", initials: "DP", role: "Check-in, Cleaning, Inspection", rating: 4.9, primary: ["Birch Street House"], connected: "Feb 25, 2026", marketplace: false },
  { id: "t6", name: "Talia Brooks", initials: "TB", role: "Cleaning", rating: 4.7, primary: ["Vineyard Country Home"], connected: "Jul 04, 2025", marketplace: false },
  { id: "t7", name: "Marco Ruiz", initials: "MR", role: "Maintenance", rating: 4.8, primary: ["Vineyard Country Home"], connected: "Feb 02, 2026", marketplace: false },
  { id: "t8", name: "Rosa Mendez", initials: "RM", role: "Cleaning", rating: 4.6, primary: [], connected: "Nov 09, 2025", marketplace: false },
];

export type CoHostPaymentMethod = { type: "card" | "bank"; brand: string; last4: string; holder: string };

export const coHosts: Array<{
  id: string;
  name: string;
  initials: string;
  properties: string;
  since: string;
  paymentMethod: CoHostPaymentMethod;
}> = [
  { id: "c1", name: "Priya Anand", initials: "PA", properties: "Hilltop Hideaway w Hot Tub & Fire Pit", since: "Jul 09, 2025", paymentMethod: { type: "card", brand: "Visa", last4: "1111", holder: "Priya Anand" } },
  { id: "c2", name: "Sam Carter", initials: "SC", properties: "All properties", since: "Jul 09, 2025", paymentMethod: { type: "bank", brand: "Checking", last4: "2222", holder: "Sam Carter" } },
  { id: "c3", name: "Janet Cole", initials: "JC", properties: "Creekside Modern · Hot Tub · Creek Views · Sleeps 8", since: "Apr 09, 2026", paymentMethod: { type: "card", brand: "Mastercard", last4: "3333", holder: "Janet Cole" } },
  { id: "c4", name: "Karen Riley", initials: "KR", properties: "Riverbend Lodge · Hot Tub · Game Room · Family Ready", since: "Apr 01, 2026", paymentMethod: { type: "card", brand: "Amex", last4: "4444", holder: "Karen Riley" } },
  { id: "c5", name: "Renata Alvarez", initials: "RA", properties: "Cedar Loop Loft", since: "Feb 22, 2026", paymentMethod: { type: "bank", brand: "Checking", last4: "5555", holder: "Renata Alvarez" } },
];

export const popularChecklists = [
  { id: "ch1", name: "Standard Turnover", tasks: 42, downloads: "12.4k" },
  { id: "ch2", name: "Deep Clean", tasks: 78, downloads: "8.1k" },
  { id: "ch3", name: "Post-Construction", tasks: 95, downloads: "3.2k" },
  { id: "ch4", name: "Quick Stage", tasks: 18, downloads: "15.7k" },
  { id: "ch5", name: "Hot Tub Property", tasks: 24, downloads: "5.6k" },
  { id: "ch6", name: "Pet-Friendly Reset", tasks: 31, downloads: "4.4k" },
];

export type PaymentMethod = {
  id: string;
  type: "card" | "bank";
  brand: string;
  last4: string;
  exp?: string;
  holder: string;
  isDefault: boolean;
};

export const paymentMethods: PaymentMethod[] = [
  { id: "pm1", type: "card", brand: "Visa", last4: "4242", exp: "08/27", holder: "Jordan Avery", isDefault: true },
  { id: "pm2", type: "card", brand: "Mastercard", last4: "5577", exp: "11/26", holder: "Jordan Avery", isDefault: false },
  { id: "pm3", type: "bank", brand: "Checking", last4: "9921", holder: "Jordan Avery", isDefault: false },
];

export type Payment = {
  id: string;
  date: string;
  cleaner: string;
  property: string;
  amount: number;
  status: "paid" | "pending";
  methodId: string;
};

export const payments: Payment[] = [
  { id: "py1", date: "May 2, 2026", cleaner: "Maria Delgado", property: "Riverbend Lodge", amount: 185, status: "paid", methodId: "pm1" },
  { id: "py2", date: "May 1, 2026", cleaner: "Grace Holloway", property: "Desert View Villa", amount: 175, status: "paid", methodId: "pm1" },
  { id: "py3", date: "Apr 30, 2026", cleaner: "Maria Delgado", property: "Hilltop Hideaway", amount: 350, status: "pending", methodId: "pm3" },
  { id: "py4", date: "Apr 29, 2026", cleaner: "Talia Brooks", property: "Vineyard Country", amount: 300, status: "paid", methodId: "pm2" },
  { id: "py5", date: "Apr 28, 2026", cleaner: "Diana Park", property: "Birch Street House", amount: 200, status: "paid", methodId: "pm1" },
];

export type AutopaymentTrigger = "after_completion" | "weekly";

export type AutopaymentRule = {
  id: string;
  cleaner: string;
  trigger: AutopaymentTrigger;
  weekday?: string;
  methodId: string;
  cap?: number;
  enabled: boolean;
};

export const autopaymentRules: AutopaymentRule[] = [
  { id: "ap1", cleaner: "Maria Delgado", trigger: "after_completion", methodId: "pm1", cap: 500, enabled: true },
  { id: "ap2", cleaner: "Diana Park", trigger: "weekly", weekday: "Friday", methodId: "pm1", cap: 800, enabled: false },
];

export const cleanerSearches: any[] = [];

export type PropertyAssignments = {
  ownerId: string | null;
  cleanerIds: string[];
  paymentMethodIds: string[];
  payoutMethodId: string | null;
  checklistIds: string[];
  inventoryIds: string[];
  description?: string;
};

export const propertyOwners = [
  { id: "o1", name: "Priya Anand", email: "priya@example.com", phone: "(541) 555-0182" },
  { id: "o2", name: "Janet Cole", email: "janet@example.com", phone: "(541) 555-0144" },
  { id: "o3", name: "Karen Riley", email: "karen@example.com", phone: "(541) 555-0177" },
  { id: "o4", name: "Renata Alvarez", email: "renata@example.com", phone: "(541) 555-0166" },
  { id: "o5", name: "Sam Carter", email: "sam@example.com", phone: "(541) 555-0199" },
];

export const inventoryLists = [
  { id: "iv1", name: "Standard Linens & Towels", items: 24 },
  { id: "iv2", name: "Kitchen Essentials", items: 38 },
  { id: "iv3", name: "Bath Amenities", items: 16 },
  { id: "iv4", name: "Hot Tub Supplies", items: 9 },
  { id: "iv5", name: "Cleaning Chemicals", items: 21 },
];

export const propertyAssignments: Record<string, PropertyAssignments> = {
  p1: { ownerId: "o4", cleanerIds: ["t4"], paymentMethodIds: ["pm1"], payoutMethodId: "pm3", checklistIds: ["ch1", "ch4"], inventoryIds: ["iv1", "iv2"] },
  p2: { ownerId: "o3", cleanerIds: ["t1"], paymentMethodIds: ["pm1", "pm2"], payoutMethodId: "pm3", checklistIds: ["ch1", "ch5"], inventoryIds: ["iv1", "iv2", "iv4"] },
  p3: { ownerId: "o2", cleanerIds: ["t1"], paymentMethodIds: ["pm1"], payoutMethodId: "pm3", checklistIds: ["ch1"], inventoryIds: ["iv1", "iv3"] },
  p4: { ownerId: "o5", cleanerIds: ["t5"], paymentMethodIds: ["pm2"], payoutMethodId: "pm3", checklistIds: ["ch1", "ch2"], inventoryIds: ["iv1", "iv5"] },
  p5: { ownerId: "o4", cleanerIds: ["t1", "t5"], paymentMethodIds: ["pm1"], payoutMethodId: "pm3", checklistIds: ["ch1"], inventoryIds: ["iv1", "iv2"] },
  p6: { ownerId: "o1", cleanerIds: ["t1"], paymentMethodIds: ["pm1", "pm3"], payoutMethodId: "pm3", checklistIds: ["ch1", "ch5"], inventoryIds: ["iv1", "iv4"] },
  p7: { ownerId: "o2", cleanerIds: ["t1"], paymentMethodIds: ["pm1"], payoutMethodId: "pm3", checklistIds: ["ch1"], inventoryIds: ["iv1"] },
  p8: { ownerId: "o3", cleanerIds: ["t6", "t7"], paymentMethodIds: ["pm2"], payoutMethodId: "pm3", checklistIds: ["ch1", "ch6"], inventoryIds: ["iv1", "iv2", "iv3"] },
};

export type IntegrationProvider = {
  id: string;
  name: string;
  category: "PMS" | "OTA";
  description: string;
};

export const integrationProviders: IntegrationProvider[] = [
  { id: "hostaway", name: "Hostaway", category: "PMS", description: "All-in-one PMS for short-term rentals" },
  { id: "guesty", name: "Guesty", category: "PMS", description: "Property management for hosts at scale" },
  { id: "ownerrez", name: "OwnerRez", category: "PMS", description: "Vacation rental software & channel manager" },
  { id: "airbnb", name: "Airbnb", category: "OTA", description: "Sync listings and reservations" },
  { id: "vrbo", name: "Vrbo", category: "OTA", description: "Sync listings and reservations" },
  { id: "booking", name: "Booking.com", category: "OTA", description: "Sync listings and reservations" },
];

export type PropertyIntegration = {
  providerId: string;
  status: "connected" | "disconnected";
  lastSync?: string;
  externalId?: string;
};

export const propertyIntegrations: Record<string, PropertyIntegration[]> = {
  p1: [{ providerId: "hostaway", status: "connected", lastSync: "2 hours ago", externalId: "HA-10241" }, { providerId: "airbnb", status: "connected", lastSync: "10 min ago", externalId: "ABNB-DV-001" }],
  p2: [{ providerId: "hostaway", status: "connected", lastSync: "1 hour ago", externalId: "HA-10242" }],
  p3: [{ providerId: "airbnb", status: "connected", lastSync: "30 min ago", externalId: "ABNB-CM-001" }, { providerId: "vrbo", status: "connected", lastSync: "1 day ago", externalId: "VRBO-CM-001" }],
  p4: [],
  p5: [{ providerId: "guesty", status: "connected", lastSync: "5 hours ago", externalId: "GST-CL-001" }],
  p6: [{ providerId: "hostaway", status: "connected", lastSync: "20 min ago", externalId: "HA-10246" }, { providerId: "airbnb", status: "connected", lastSync: "1 hour ago", externalId: "ABNB-HH-001" }, { providerId: "booking", status: "connected", lastSync: "3 hours ago", externalId: "BDC-HH-001" }],
  p7: [],
  p8: [{ providerId: "ownerrez", status: "connected", lastSync: "1 day ago", externalId: "OR-VC-001" }],
};

export type InventoryCategory = "Linens" | "Kitchen" | "Bath" | "Cleaning" | "Other";

export type InventoryLevel = { current: number; reorderAt: number; max: number };

export type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  amazonUrl?: string;
  perProperty: Record<string, InventoryLevel>;
  reorderPending?: boolean;
  lastOrderedAt?: string;
  unitCost?: number;
};

export const inventoryItems: InventoryItem[] = [
  {
    id: "it1", name: "Bath towels", category: "Bath", unit: "each", unitCost: 12,
    amazonUrl: "https://www.amazon.com/s?k=bath+towels",
    perProperty: {
      p1: { current: 4, reorderAt: 6, max: 16 },
      p2: { current: 12, reorderAt: 8, max: 20 },
      p6: { current: 2, reorderAt: 8, max: 24 },
    },
  },
  {
    id: "it2", name: "Toilet paper (12-pack)", category: "Bath", unit: "pack", unitCost: 18,
    amazonUrl: "https://www.amazon.com/s?k=toilet+paper",
    perProperty: {
      p1: { current: 2, reorderAt: 2, max: 6 },
      p2: { current: 4, reorderAt: 3, max: 8 },
      p3: { current: 1, reorderAt: 2, max: 4 },
      p4: { current: 5, reorderAt: 2, max: 6 },
      p6: { current: 3, reorderAt: 3, max: 8 },
    },
  },
  {
    id: "it3", name: "Dish soap", category: "Kitchen", unit: "bottle", unitCost: 5,
    amazonUrl: "https://www.amazon.com/s?k=dish+soap",
    perProperty: {
      p2: { current: 3, reorderAt: 1, max: 4 },
      p3: { current: 0, reorderAt: 1, max: 3 },
      p5: { current: 2, reorderAt: 1, max: 4 },
    },
  },
  {
    id: "it4", name: "Laundry detergent", category: "Cleaning", unit: "jug", unitCost: 22,
    amazonUrl: "https://www.amazon.com/s?k=laundry+detergent",
    perProperty: {
      p1: { current: 2, reorderAt: 1, max: 3 },
      p2: { current: 1, reorderAt: 1, max: 3 },
      p6: { current: 0, reorderAt: 1, max: 3 },
      p8: { current: 3, reorderAt: 1, max: 3 },
    },
  },
  {
    id: "it5", name: "Coffee pods", category: "Kitchen", unit: "box", unitCost: 28,
    amazonUrl: "https://www.amazon.com/s?k=coffee+pods",
    perProperty: {
      p2: { current: 1, reorderAt: 2, max: 6 },
      p3: { current: 4, reorderAt: 2, max: 6 },
      p4: { current: 2, reorderAt: 2, max: 4 },
      p7: { current: 0, reorderAt: 2, max: 4 },
    },
  },
  {
    id: "it6", name: "Shampoo & conditioner kit", category: "Bath", unit: "kit", unitCost: 9,
    amazonUrl: "https://www.amazon.com/s?k=hotel+shampoo",
    perProperty: {
      p1: { current: 8, reorderAt: 6, max: 20 },
      p4: { current: 14, reorderAt: 6, max: 20 },
      p5: { current: 5, reorderAt: 6, max: 16 },
    },
  },
  {
    id: "it7", name: "King bed sheet set", category: "Linens", unit: "set", unitCost: 45,
    amazonUrl: "https://www.amazon.com/s?k=king+sheets",
    perProperty: {
      p2: { current: 2, reorderAt: 2, max: 4 },
      p6: { current: 3, reorderAt: 2, max: 4 },
      p8: { current: 1, reorderAt: 2, max: 4 },
    },
  },
  {
    id: "it8", name: "All-purpose cleaner", category: "Cleaning", unit: "spray", unitCost: 6,
    amazonUrl: "https://www.amazon.com/s?k=all+purpose+cleaner",
    perProperty: {
      p1: { current: 3, reorderAt: 2, max: 5 },
      p3: { current: 2, reorderAt: 2, max: 4 },
      p5: { current: 1, reorderAt: 2, max: 4 },
      p6: { current: 4, reorderAt: 2, max: 5 },
    },
  },
];
