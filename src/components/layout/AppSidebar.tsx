import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Calendar, AlertTriangle, Star, CreditCard,
  Building2, KeyRound, ListChecks, Package, Users, Sparkles, LineChart, UserCog, ChevronDown, Sun, Sunrise, Wallet, FileText,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth, canAccess } from "@/lib/auth";

type Item = {
  title: string;
  url?: string;
  icon: any;
  badge?: number;
  children?: { title: string; url: string }[];
};

// Turnpoint nav — focused on the turnover loop. Legacy wide/mock pages
// (Payments, Property problems, Inventory, My team) are hidden for now: the
// routes still exist, they're just off the nav until rebuilt with real depth.
const items: Item[] = [
  { title: "Readiness", url: "/today", icon: Sun },
  { title: "My day", url: "/run", icon: Sunrise },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/projects/schedule", icon: Calendar },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Checklists", url: "/checklists", icon: ListChecks },
  { title: "Pay", url: "/pay", icon: Wallet },
  { title: "Owner reports", url: "/reports/owner", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { roles } = useAuth();
  const isActive = (u?: string) => !!u && pathname === u;
  const visibleItems = items
    .map((item) => {
      if (item.children) {
        const kids = item.children.filter((c) => canAccess(roles, c.url));
        return kids.length ? { ...item, children: kids } : null;
      }
      return canAccess(roles, item.url!) ? item : null;
    })
    .filter(Boolean) as Item[];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={`border-b border-sidebar-border h-16 flex flex-row items-center ${collapsed ? "justify-center px-0" : "px-5"}`}>
        <NavLink to="/dashboard" className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
          <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-primary" />
          </div>
          {!collapsed && <span className="font-display text-2xl font-semibold tracking-tight">Turnpoint</span>}
        </NavLink>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                if (item.children) {
                  const expanded = item.children.some((c) => isActive(c.url));
                  return (
                    <Collapsible key={item.title} defaultOpen={expanded} className="group/collapse">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className={`w-full ${collapsed ? "justify-center" : ""}`}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <>
                                <span className="flex-1 text-left">{item.title}</span>
                                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapse:rotate-180" />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        {!collapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map((c) => (
                                <SidebarMenuSubItem key={c.url}>
                                  <SidebarMenuSubButton asChild isActive={isActive(c.url)}>
                                    <NavLink to={c.url} className={collapsed ? "justify-center" : ""}>
                                      {c.title}
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url!} className={collapsed ? "justify-center" : ""}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            {item.badge && (
                              <span className="ml-auto text-xs font-mono bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
