import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, LogOut, User as UserIcon, Settings, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

type Notification = {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
};

const initialNotifications: Notification[] = [
  { id: "1", title: "New booking confirmed", description: "Beach House cleaning scheduled for tomorrow at 10:00 AM.", time: "5m ago", read: false },
  { id: "2", title: "Payment received", description: "$245.00 payment from Sarah J. for Lakeview Cottage.", time: "1h ago", read: false },
  { id: "3", title: "Problem reported", description: "Broken faucet reported at Downtown Loft.", time: "3h ago", read: false },
  { id: "4", title: "Cleaner checked in", description: "Maria started cleaning at Mountain Cabin.", time: "Yesterday", read: true },
  { id: "5", title: "Review submitted", description: "5-star review from a recent guest.", time: "2d ago", read: true },
];

export const AppHeader = ({ title }: { title: string }) => {
  const nav = useNavigate();
  const { user, roles, signOut } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const unread = notifications.filter((n) => !n.read).length;
  const initials = (user?.user_metadata?.full_name || user?.email || "U")
    .split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();
  const primaryRole = roles[0] ?? "client";
  const displayName = user?.user_metadata?.full_name || user?.email || "Account";

  const markAllRead = () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) =>
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));

  return (
    <header className="h-16 border-b border-border bg-background flex items-center px-4 sm:px-6 lg:px-8 gap-3 sticky top-0 z-30">
      <SidebarTrigger className="h-9 w-9 shrink-0" />
      <h1 className="font-display text-xl font-semibold tracking-tight flex-1 min-w-0 truncate">{title}</h1>
      <div className="flex items-center gap-1.5 shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="relative h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 text-[10px] font-mono bg-destructive text-destructive-foreground rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="font-semibold text-sm">Notifications</div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  You're all caught up
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${
                      !n.read ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-1">{n.time}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Badge variant="outline" className="hidden sm:inline-flex capitalize">{primaryRole}</Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="hidden sm:flex w-9 h-9 rounded-full bg-primary text-primary-foreground items-center justify-center font-semibold text-sm hover:opacity-90 transition-opacity"
              aria-label="Account menu"
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold truncate">{displayName}</span>
                <span className="text-xs text-muted-foreground font-normal capitalize">{primaryRole}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => nav("/profile")}>
              <UserIcon className="h-4 w-4 mr-2" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/payments")}>
              <Settings className="h-4 w-4 mr-2" /> Payments
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={async () => { await signOut(); nav("/login"); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
