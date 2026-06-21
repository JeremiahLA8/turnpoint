import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

const titleMap: Record<string, string> = {
  "/today": "Readiness",
  "/run": "My day",
  "/pay": "Pay",
  "/reports/owner": "Owner reports",
  "/dashboard": "Welcome, Jordan",
  "/cleaner-search": "Cleaner Search",
  "/projects/schedule": "Schedule",
  "/projects/list": "Projects",
  "/projects/reports": "Reports",
  "/property-problems": "Property Problems",
  "/quality-center": "Performance Bonus",
  "/payments": "Payments",
  "/properties": "Properties",
  "/check-in": "Check-in / Welcoming",
  "/checklists/mine": "My Checklists",
  "/checklists/popular": "Popular Checklists",
  "/inventory": "Inventory",
  "/my-team": "My Team",
  "/guest-center": "Guest Center",
  "/host-services": "Host Services",
  "/profile": "Property Manager Profile",
};

export const AppLayout = () => {
  const { pathname } = useLocation();
  const title = titleMap[pathname] ?? "Turnpoint";
  return (
    <SidebarProvider>
      <div className="min-h-svh flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader title={title} />
          <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
