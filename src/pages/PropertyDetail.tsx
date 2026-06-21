import { useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { propertyAssignments } from "@/data/mockData";
import { useProperty } from "@/lib/api/properties";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PropertyGeneralTab } from "@/components/properties/PropertyGeneralTab";
import { PropertyPaymentsTab } from "@/components/properties/PropertyPaymentsTab";
import { PropertyTeamTab } from "@/components/properties/PropertyTeamTab";
import { PropertyChecklistsTab } from "@/components/properties/PropertyChecklistsTab";
import { PropertyIntegrationsTab } from "@/components/properties/PropertyIntegrationsTab";

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading, error } = useProperty(id);
  const [tab, setTab] = useState("general");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading property…
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-16 text-center text-destructive">
        Failed to load property: {error.message}
      </div>
    );
  }
  if (!property) return <Navigate to="/properties" replace />;

  const assign = propertyAssignments[property.id] ?? {
    ownerId: null,
    cleanerIds: [],
    paymentMethodIds: [],
    payoutMethodId: null,
    checklistIds: [],
    inventoryIds: [],
  };

  const monogram = property.name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">
      <Link to="/properties" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All properties
      </Link>

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start">
        <div className={cn("w-20 h-20 rounded-lg flex items-center justify-center shrink-0", property.color)}>
          <span className="text-2xl font-bold tracking-tight">{monogram}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
            <Badge variant="outline" className="font-mono text-[10px]">{property.completion}%</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
            <MapPin className="h-3.5 w-3.5" /> {property.address}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="checklists">Checklists & Inventory</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <PropertyGeneralTab property={property} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PropertyPaymentsTab property={property} assignments={assign} />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <PropertyTeamTab assignments={assign} />
        </TabsContent>
        <TabsContent value="checklists" className="mt-4">
          <PropertyChecklistsTab propertyId={property.id} assignments={assign} />
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <PropertyIntegrationsTab property={property} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PropertyDetail;
