import { Navigate, useLocation } from "react-router-dom";
import { useAuth, landingFor, type AppRole } from "@/lib/auth";
import { ShieldAlert, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
  /** Roles that may access this route. Omit to require auth only. */
  roles?: AppRole[];
};

const SLOW_LOAD_HINT_MS = 5000;

const AuthLoading = () => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_LOAD_HINT_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-[60vh] flex flex-col items-center justify-center gap-3"
    >
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
      {slow && (
        <p className="text-xs text-muted-foreground max-w-xs text-center">
          Still loading your account… this is taking longer than usual.
        </p>
      )}
    </div>
  );
};

const RolesErrorScreen = ({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) => {
  const [retrying, setRetrying] = useState(false);
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 gap-4">
      <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
        <AlertCircle className="h-7 w-7 text-warning" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Couldn't load your permissions</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">{message}</p>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={async () => {
            setRetrying(true);
            await onRetry();
            setRetrying(false);
          }}
          disabled={retrying}
        >
          {retrying ? "Retrying…" : "Try again"}
        </Button>
        <Button variant="outline" onClick={onSignOut}>Sign out</Button>
      </div>
    </div>
  );
};

export const RequireAuth = ({ children, roles: allowed }: Props) => {
  const { user, roles, loading, rolesError, reloadRoles, signOut } = useAuth();
  const loc = useLocation();

  if (loading) return <AuthLoading />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  // Roles failed to load (timeout or DB error) — give the user a way out
  // instead of leaving them stuck on a spinner or bouncing to "Access denied".
  if (rolesError) {
    return <RolesErrorScreen message={rolesError} onRetry={reloadRoles} onSignOut={signOut} />;
  }

  if (allowed && !roles.some((r) => allowed.includes(r))) {
    return <Unauthorized allowed={allowed} userRoles={roles} />;
  }

  return <>{children}</>;
};

const Unauthorized = ({ allowed, userRoles }: { allowed: AppRole[]; userRoles: AppRole[] }) => {
  const home = landingFor(userRoles);
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 gap-4">
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldAlert className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Access denied</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          This page is restricted to{" "}
          <span className="font-medium text-foreground capitalize">{allowed.join(", ")}</span>.
          Your role{userRoles.length > 1 ? "s are" : " is"}{" "}
          <span className="font-medium text-foreground capitalize">
            {userRoles.length ? userRoles.join(", ") : "none"}
          </span>
          .
        </p>
      </div>
      <Button asChild variant="outline">
        <a href={home}>Go to your home</a>
      </Button>
    </div>
  );
};
