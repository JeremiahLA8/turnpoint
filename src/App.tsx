import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "./lib/queryPersist";
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";
import { OfflineQueueIndicator } from "./components/OfflineQueueIndicator";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { AppLayout } from "./components/layout/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
import { AuthProvider, ROUTE_ROLES } from "./lib/auth";
import Dashboard from "./pages/Dashboard";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import Today from "./pages/Today";
import CleanerRun from "./pages/CleanerRun";
import Pay from "./pages/Pay";
import OwnerReport from "./pages/OwnerReport";
import { useAuth } from "./lib/auth";
import Schedule from "./pages/Schedule";
import ProjectsList from "./pages/ProjectsList";
import Reports from "./pages/Reports";
import PropertyProblems from "./pages/PropertyProblems";
import ProblemDetail from "./pages/ProblemDetail";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import MyTeam from "./pages/MyTeam";
import Payments from "./pages/Payments";
import Profile from "./pages/Profile";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import SmsOptIn from "./pages/SmsOptIn";
import { MyChecklists, ChecklistBuilder } from "./pages/Checklists";
import { QualityCenter, CheckIn, GuestCenter, HostServices } from "./pages/FeaturePages";
import Inventory from "./pages/Inventory";

const queryClient = makeQueryClient();

const Gate = ({ path, children }: { path: keyof typeof ROUTE_ROLES; children: React.ReactNode }) => (
  <RequireAuth roles={ROUTE_ROLES[path]}>{children}</RequireAuth>
);

const DashboardRouter = () => {
  const { roles } = useAuth();
  if (roles.includes("admin")) return <Dashboard />;
  if (roles.includes("technician")) return <TechnicianDashboard />;
  return <Dashboard />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAUpdatePrompt />
      <OfflineQueueIndicator />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/sms-opt-in" element={<SmsOptIn />} />

            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/today" element={<Gate path="/today"><Today /></Gate>} />
              <Route path="/run" element={<Gate path="/run"><CleanerRun /></Gate>} />
              <Route path="/pay" element={<Gate path="/pay"><Pay /></Gate>} />
              <Route path="/reports/owner" element={<Gate path="/reports/owner"><OwnerReport /></Gate>} />
              <Route path="/dashboard" element={<Gate path="/dashboard"><DashboardRouter /></Gate>} />


              <Route path="/projects" element={<Navigate to="/projects/schedule" replace />} />
              <Route path="/projects/schedule" element={<Gate path="/projects/schedule"><Schedule /></Gate>} />
              <Route path="/projects/list" element={<Gate path="/projects/list"><ProjectsList /></Gate>} />
              <Route path="/projects/reports" element={<Gate path="/projects/reports"><Reports /></Gate>} />

              <Route path="/property-problems" element={<Gate path="/property-problems"><PropertyProblems /></Gate>} />
              <Route path="/property-problems/:id" element={<Gate path="/property-problems"><ProblemDetail /></Gate>} />
              <Route path="/quality-center" element={<Gate path="/quality-center"><QualityCenter /></Gate>} />
              <Route path="/payments" element={<Gate path="/payments"><Payments /></Gate>} />
              <Route path="/properties" element={<Gate path="/properties"><Properties /></Gate>} />
              <Route path="/properties/:id" element={<Gate path="/properties"><PropertyDetail /></Gate>} />
              <Route path="/check-in" element={<Gate path="/check-in"><CheckIn /></Gate>} />

              <Route path="/checklists" element={<Gate path="/checklists"><MyChecklists /></Gate>} />
              <Route path="/checklists/new" element={<Gate path="/checklists"><ChecklistBuilder /></Gate>} />
              <Route path="/checklists/:id" element={<Gate path="/checklists"><ChecklistBuilder /></Gate>} />
              <Route path="/checklists/mine" element={<Navigate to="/checklists" replace />} />
              <Route path="/checklists/popular" element={<Navigate to="/checklists" replace />} />

              <Route path="/inventory" element={<Gate path="/inventory"><Inventory /></Gate>} />
              <Route path="/my-team" element={<Gate path="/my-team"><MyTeam /></Gate>} />
              <Route path="/guest-center" element={<Gate path="/guest-center"><GuestCenter /></Gate>} />
              <Route path="/host-services" element={<Gate path="/host-services"><HostServices /></Gate>} />
              <Route path="/profile" element={<Gate path="/profile"><Profile /></Gate>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
