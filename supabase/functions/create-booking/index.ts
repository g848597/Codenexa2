// supabase/functions/create-booking/index.ts
// Единственный способ создать запись как клиент (анонимно).
// Валидирует данные, пересчитывает слоты на сервере, и только потом пишет в БД.
// Использует service_role key — RLS для этой функции не применяется,
// поэтому вся защита реализована внутри самой функции + EXCLUDE constraint в БД
// как последний рубеж на случай гонки запросов.

import { corsHeaders } from "../_shared/cors.ts";
import { adminClient, computeSlots } from "../_shared/slots.ts";

const RATE_LIMIT_MAX = 5;         // попыток
const RATE_LIMIT_WINDOW_MIN = 10; // за столько минут

const NAME_RE = /^[\p{L}\p{M}\s'-]{2,100}$/u;
// казахстанский/международный формат: +7XXXXXXXXXX, 8XXXXXXXXXX, +XXXXXXXXXXXX и т.п.
const PHONE_RE = /^\+?\d{10,15}$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const supabase = adminClient();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  try {
    // ---- rate limiting ----
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString();
    const { count, error: rlErr } = await supabase
      .from("booking_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", windowStart);
    if (rlErr) throw rlErr;
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return json({ error: "RATE_LIMITED" }, 429);
    }
    await supabase.from("booking_attempts").insert({ ip });

    // ---- payload + валидация ----
    const body = await req.json();
    const service_id = String(body.service_id ?? "");
    const date = String(body.date ?? "");
    const start_time = String(body.start_time ?? "");
    const name = String(body.name ?? "").trim();
    const phoneRaw = String(body.phone ?? "").trim();
    const whatsappRaw = String(body.whatsapp ?? "").trim() || phoneRaw;
    const comment = String(body.comment ?? "").trim().slice(0, 500);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "INVALID_DATE" }, 400);
    if (!/^\d{2}:\d{2}$/.test(start_time)) return json({ error: "INVALID_TIME" }, 400);
    if (!NAME_RE.test(name)) return json({ error: "INVALID_NAME" }, 400);
    const phoneDigits = phoneRaw.replace(/[^\d+]/g, "");
    if (!PHONE_RE.test(phoneDigits)) return json({ error: "INVALID_PHONE" }, 400);
    const whatsappDigits = whatsappRaw.replace(/[^\d+]/g, "");

    const { data: service, error: svcErr } = await supabase
      .from("services")
      .select("id, name, price, duration, active")
      .eq("id", service_id)
      .maybeSingle();
    if (svcErr) throw svcErr;
    if (!service || !service.active) return json({ error: "SERVICE_NOT_FOUND" }, 404);

    // ---- пересчёт слотов на сервере: не доверяем тому, что прислал браузер ----
    const slots = await computeSlots(supabase, date, service.duration);
    const slot = slots.find((s) => s.time === start_time);
    if (!slot || !slot.available) {
      return json({ error: "SLOT_TAKEN" }, 409);
    }

    const [h, m] = start_time.split(":").map(Number);
    const endMin = h * 60 + m + service.duration;
    const end_time = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    // ---- вставка. EXCLUDE constraint в БД — финальная гарантия от гонки ----
    const { data: booking, error: insErr } = await supabase
      .from("bookings")
      .insert({
        client_name: name,
        phone: phoneDigits,
        whatsapp: whatsappDigits,
        service_id: service.id,
        service_name: service.name,
        price: service.price,
        date,
        start_time,
        end_time,
        status: "confirmed",
        comment,
      })
      .select()
      .single();

    if (insErr) {
      // 23P01 = exclusion_violation → кто-то успел занять этот слот на долю секунды раньше
      if ((insErr as any).code === "23P01") {
        return json({ error: "SLOT_TAKEN" }, 409);
      }
      throw insErr;
    }

    // ---- уведомление админу (не блокирует ответ клиенту при сбое) ----
    notifyAdmin(supabase, booking).catch((e) => console.error("notifyAdmin failed:", e));

    return json({ booking }, 201);
  } catch (e) {
    console.error(e);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});

async function notifyAdmin(supabase: ReturnType<typeof adminClient>, booking: any) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return;

  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "telegram_chat_id")
    .maybeSingle();
  const chatId = setting?.value;
  if (!chatId) return;

  const text =
    `Новая запись ✅\n` +
    `${booking.service_name}\n` +
    `${booking.date} ${booking.start_time}–${booking.end_time}\n` +
    `${booking.client_name}, ${booking.phone}` +
    (booking.comment ? `\nКомментарий: ${booking.comment}` : "");

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
