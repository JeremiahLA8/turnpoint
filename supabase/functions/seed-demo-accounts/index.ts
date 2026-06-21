import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO = [
  { email: "admin@demo.sweepr.app",      password: "demo1234", full_name: "Avery Admin",      role: "admin" },
  { email: "manager@demo.sweepr.app",    password: "demo1234", full_name: "Morgan Manager",   role: "manager" },
  { email: "technician@demo.sweepr.app", password: "demo1234", full_name: "Toni Technician", role: "technician" },
  { email: "client@demo.sweepr.app",     password: "demo1234", full_name: "Casey Client",     role: "client" },
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: any[] = [];

    for (const u of DEMO) {
      // Check if user already exists
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users.find((x) => x.email === u.email);

      let userId: string;
      if (existing) {
        userId = existing.id;
        // Reset password so it always matches
        await admin.auth.admin.updateUserById(userId, {
          password: u.password,
          user_metadata: { full_name: u.full_name },
        });
        results.push({ email: u.email, status: "updated" });
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
        if (error) throw error;
        userId = data.user!.id;
        results.push({ email: u.email, status: "created" });
      }

      // Make sure profile exists
      await admin.from("profiles").upsert({ id: userId, full_name: u.full_name });

      // Replace roles with the desired one
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: u.role });
    }

    return new Response(
      JSON.stringify({ ok: true, accounts: DEMO.map(({ password, ...r }) => r), results }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
