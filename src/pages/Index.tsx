import { Navigate } from "react-router-dom";
import { useAuth, landingFor } from "@/lib/auth";

const Index = () => {
  const { user, roles, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? landingFor(roles) : "/login"} replace />;
};
export default Index;
