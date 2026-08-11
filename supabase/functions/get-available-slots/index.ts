// supabase/functions/get-available-slots/index.ts
// Публичная функция: принимает {date, service_id}, отдаёт актуальные слоты.
// Расчёт всегда идёт на сервере (service_role), фронт только отображает результат.

import { corsHeaders } from "../_shared/cors.ts";
import { adminClient, computeSlots } from "../_shared/slots.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { date, service_id } = await req.json();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: "INVALID_DATE" }, 400);
    }
    if (!service_id) {
      return json({ error: "INVALID_SERVICE" }, 400);
    }

    const supabase = adminClient();

    const { data: service, error: svcErr } = await supabase
      .from("services")
      .select("duration, active")
      .eq("id", service_id)
      .maybeSingle();

    if (svcErr) throw svcErr;
    if (!service || !service.active) return json({ error: "SERVICE_NOT_FOUND" }, 404);

    const slots = await computeSlots(supabase, date, service.duration);
    return json({ slots });
  } catch (e) {
    console.error(e);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
