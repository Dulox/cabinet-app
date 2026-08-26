// Supabase Edge Function: admin-set-password
//
// Lets a verified admin set another user's password directly.
// The service role key is only ever read here, on the server — it is never
// sent to the browser, so this is safe unlike embedding it in the React app.
//
// Deploy with:
//   supabase functions deploy admin-set-password
//
// This function relies on two secrets that Supabase provides automatically
// to every Edge Function project — you do NOT need to set them yourself:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace("Bearer ", "");
    if (!callerToken) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server is missing Supabase configuration" }, 500);
    }

    // Admin client — uses the service role key, only available inside this function
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the CALLER is who their token says they are
    const { data: callerData, error: callerErr } = await adminClient.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) {
      return json({ error: "Invalid or expired session" }, 401);
    }

    // Verify the CALLER is actually an admin in your profiles table
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", callerData.user.id)
      .single();

    if (profileErr || !callerProfile?.is_admin) {
      return json({ error: "You are not authorized to perform this action" }, 403);
    }

    // Parse the request body
    const { targetUserId, newPassword } = await req.json();
    if (!targetUserId || !newPassword) {
      return json({ error: "targetUserId and newPassword are required" }, 400);
    }
    if (newPassword.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // Perform the actual password change using the service role key
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateErr) {
      return json({ error: updateErr.message }, 400);
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
