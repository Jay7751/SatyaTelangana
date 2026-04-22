// supabase/functions/create-journalist/index.ts
// Deploy: supabase functions deploy create-journalist
//
// Why this exists: The mobile app uses the anon key (correct).
// auth.admin.createUser() requires the service role key which must
// NEVER go in a mobile app. This function runs server-side with it.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify caller is an admin using their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const { data: profile } = await supabaseClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") throw new Error("Unauthorized — admin role required");

    // Use service role key to create user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, name } = await req.json();
    if (!email || !name) throw new Error("email and name are required");

    // Generate strong temporary password
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    const tempPassword = Array.from({ length: 14 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: name.trim() },
    });

    if (authError) throw authError;

    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: "journalist",
      isapproved: true,
      createdat: new Date().toISOString(),
    });

    if (profileError) {
      // Rollback auth user if profile insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return new Response(
      JSON.stringify({ success: true, userId: authData.user.id, tempPassword }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
