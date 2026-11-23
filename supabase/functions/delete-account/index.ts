import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Удаление аккаунта (требование App Store): удаляет пользователя, его фото и все данные (каскадом).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return new Response(JSON.stringify({ error: "not signed in" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const id = data.user.id;
  const { data: files } = await admin.storage.from("photos").list(id, { limit: 1000 });
  if (files?.length) await admin.storage.from("photos").remove(files.map((f) => `${id}/${f.name}`));
  const { error: delError } = await admin.auth.admin.deleteUser(id);
  if (delError) {
    return new Response(JSON.stringify({ error: delError.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
});
