// Общая логика расчёта свободных слотов. Выполняется ТОЛЬКО на сервере
// (Edge Function, service_role), никогда не доверяет данным из браузера.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Часовой пояс студии (Усть-Каменогорск → Asia/Almaty, UTC+5).
// Поменяйте, если мастер работает в другом городе/поясе.
export const STUDIO_TZ = "Asia/Almaty";

export interface Slot {
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

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

/**
 * Пересчитывает свободные слоты для даты и длительности услуги,
 * используя актуальные working_hours / breaks / bookings / blocked_slots.
 * Это единственный источник истины — фронт ничего не считает сам.
 */
export async function computeSlots(
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

  // Edge Functions выполняются в UTC, а студия — в казахстанском времени,
  // поэтому "сегодня/сейчас" считаем явно в нужной таймзоне, а не в UTC.
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
