import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, landingFor } from "@/lib/auth";
import { toast } from "sonner";

const Login = () => {
  const nav = useNavigate();
  const { user, roles, loading, signIn: signInWithRoles } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const DEMO = [
    { role: "Admin",      email: "admin@demo.sweepr.app" },
    { role: "Technician", email: "technician@demo.sweepr.app" },
    { role: "Client",     email: "client@demo.sweepr.app" },
  ];
  const DEMO_PW = "demo1234";

  const seedDemo = async () => {
    setSeeding(true);
    const { error } = await supabase.functions.invoke("seed-demo-accounts");
    setSeeding(false);
    if (error) return toast.error(error.message);
    toast.success("Demo accounts ready");
  };

  // Sign in + roles loaded together → navigate immediately, no spinner gap.
  const doSignIn = async (em: string, password: string) => {
    setBusy(true);
    const { error, roles: nextRoles } = await signInWithRoles(em, password);
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("invalid")) {
        toast.error("Invalid credentials.");
      } else toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    nav(landingFor(nextRoles), { replace: true });
  };

  const quickLogin = (demoEmail: string) => doSignIn(demoEmail, DEMO_PW);

  // Fallback: if a session is already restored on mount, redirect.
  useEffect(() => {
    if (!loading && user && !busy) nav(landingFor(roles), { replace: true });
  }, [loading, user, roles, nav, busy]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await doSignIn(email, pw);
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: name },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created");
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-primary" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Sweepr</span>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="pw">Password</Label>
                  <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full rounded-full" size="lg" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="pw2">Password</Label>
                  <Input id="pw2" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full rounded-full" size="lg" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  New accounts start with the <strong>client</strong> role. An admin can change it later.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="border-t border-border pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Demo accounts</p>
              <Button type="button" variant="ghost" size="sm" onClick={seedDemo} disabled={seeding}>
                {seeding ? "Loading…" : "Load demo accounts"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <Button
                  key={d.email}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  disabled={busy}
                  onClick={() => quickLogin(d.email)}
                >
                  <span className="font-semibold">{d.role}</span>
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Password for all demo accounts: <code className="font-mono">demo1234</code>
            </p>
          </div>
        </div>
      </div>
      <div className="hidden lg:block flex-1 bg-secondary/40 border-l border-border relative overflow-hidden">
        <div className="absolute inset-0 p-16 flex flex-col justify-center">
          <div className="text-xs font-mono text-muted-foreground mb-4">SWEEPR / OPS PLATFORM</div>
          <h2 className="text-5xl font-bold tracking-tight leading-tight max-w-md">
            Run your short-term rental cleaning operation with precision.
          </h2>
          <p className="text-muted-foreground mt-6 max-w-md">
            Schedules, cleaners, checklists, problems, payments — all in one warm, no-nonsense dashboard.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
