// supabase/functions/get-available-slots/index.ts
// Публичная функция: принимает {date, service_id}, отдаёт актуальные слоты.
// Расчёт всегда идёт на сервере (service_role), фронт только отображает результат.
// Самодостаточный файл (без относительных импортов) — можно вставить целиком
// в Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // в проде замените на конкретный домен сайта
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Часовой пояс студии (Asia/Almaty, UTC+5). Поменяйте, если мастер работает в другом поясе.
const STUDIO_TZ = "Asia/Almaty";

interface Slot {
  time: string;       // "HH:MM"
  available: boolean;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(m: number): string {
  const h = Math.floor(m / 60), min = m % 60;
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

async function computeSlots(
  supabase: SupabaseClient,
  dateStr: string,
  durationMin: number
): Promise<Slot[]> {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();

  const { data: whRows, error: whErr } = await supabase
    .from("working_hours")
    .select("*")
    .eq("day_of_week", dow)
    .maybeSingle();
  if (whErr) throw whErr;
  if (!whRows || !whRows.is_working || !whRows.start_time || !whRows.end_time) return [];

  const dayStart = timeToMin(whRows.start_time.slice(0, 5));
  const dayEnd = timeToMin(whRows.end_time.slice(0, 5));

  const { data: breaksRows, error: brErr } = await supabase
    .from("breaks")
    .select("*")
    .or(`day_of_week.eq.${dow},day_of_week.is.null`);
  if (brErr) throw brErr;

  const { data: bookingRows, error: bkErr } = await supabase
    .from("bookings")
    .select("start_time,end_time,status")
    .eq("date", dateStr)
    .neq("status", "cancelled");
  if (bkErr) throw bkErr;

  const { data: blockedRows, error: blErr } = await supabase
    .from("blocked_slots")
    .select("start_time,end_time")
    .eq("date", dateStr);
  if (blErr) throw blErr;

  const busyRanges = [
    ...(breaksRows ?? []).map((b: any) => ({ start: timeToMin(b.start_time.slice(0, 5)), end: timeToMin(b.end_time.slice(0, 5)) })),
    ...(bookingRows ?? []).map((b: any) => ({ start: timeToMin(b.start_time.slice(0, 5)), end: timeToMin(b.end_time.slice(0, 5)) })),
    ...(blockedRows ?? []).map((b: any) => ({ start: timeToMin(b.start_time.slice(0, 5)), end: timeToMin(b.end_time.slice(0, 5)) })),
  ];

  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => nowParts.find((p) => p.type === t)!.value;
  const todayStr = `${get("year")}-${get("month")}-${get("day")}`;
  const isToday = todayStr === dateStr;
  const nowMin = Number(get("hour")) * 60 + Number(get("minute"));

  const slots: Slot[] = [];
  for (let t = dayStart; t + durationMin <= dayEnd; t += 30) {
    if (isToday && t <= nowMin + 30) continue;
    const overlaps = busyRanges.some((r) => t < r.end && t + durationMin > r.start);
    slots.push({ time: minToTime(t), available: !overlaps });
  }
  return slots;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
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
