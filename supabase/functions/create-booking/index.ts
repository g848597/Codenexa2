// supabase/functions/create-booking/index.ts
// Публичная функция: принимает данные клиента + услугу/дату/время,
// проверяет их на сервере (не доверяя фронту) и создаёт запись.
// Самодостаточный файл (без относительных импортов) — можно вставить целиком
// в Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // в проде замените на конкретный домен сайта
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STUDIO_TZ = "Asia/Almaty";
const MAX_ATTEMPTS_PER_WINDOW = 5;
const WINDOW_MINUTES = 10;

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const body = await req.json();
    const {
      client_name, phone, whatsapp, service_id, date, start_time, comment,
    } = body ?? {};

    if (!client_name || String(client_name).trim().length < 2) {
      return json({ error: "INVALID_NAME" }, 400);
    }
    if (!phone || String(phone).trim().length < 5) {
      return json({ error: "INVALID_PHONE" }, 400);
    }
    if (!service_id) return json({ error: "INVALID_SERVICE" }, 400);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "INVALID_DATE" }, 400);
    if (!start_time || !/^\d{2}:\d{2}$/.test(start_time)) return json({ error: "INVALID_TIME" }, 400);

    const supabase = adminClient();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // ---- rate limiting ----
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error: rateErr } = await supabase
      .from("booking_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", windowStart);
    if (rateErr) throw rateErr;
    if ((count ?? 0) >= MAX_ATTEMPTS_PER_WINDOW) {
      return json({ error: "RATE_LIMITED" }, 429);
    }
    await supabase.from("booking_attempts").insert({ ip });

    // ---- validate service ----
    const { data: service, error: svcErr } = await supabase
      .from("services")
      .select("id, name, price, duration, active")
      .eq("id", service_id)
      .maybeSingle();
    if (svcErr) throw svcErr;
    if (!service || !service.active) return json({ error: "SERVICE_NOT_FOUND" }, 404);

    // ---- validate date is not in the past (studio timezone) ----
    const nowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: STUDIO_TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t: string) => nowParts.find((p) => p.type === t)!.value;
    const todayStr = `${get("year")}-${get("month")}-${get("day")}`;
    const nowMin = Number(get("hour")) * 60 + Number(get("minute"));
    if (date < todayStr) return json({ error: "DATE_IN_PAST" }, 400);
    const startMin = timeToMin(start_time);
    if (date === todayStr && startMin <= nowMin) {
      return json({ error: "TIME_IN_PAST" }, 400);
    }

    // ---- validate working hours ----
    const dow = new Date(date + "T00:00:00Z").getUTCDay();
    const { data: wh, error: whErr } = await supabase
      .from("working_hours")
      .select("*")
      .eq("day_of_week", dow)
      .maybeSingle();
    if (whErr) throw whErr;
    if (!wh || !wh.is_working) return json({ error: "DAY_OFF" }, 400);

    const dayStart = timeToMin(wh.start_time.slice(0, 5));
    const dayEnd = timeToMin(wh.end_time.slice(0, 5));
    const endMin = startMin + service.duration;
    if (startMin < dayStart || endMin > dayEnd) {
      return json({ error: "OUTSIDE_WORKING_HOURS" }, 400);
    }

    // ---- insert booking; DB EXCLUDE constraint prevents overlaps atomically ----
    const { data: booking, error: insErr } = await supabase
      .from("bookings")
      .insert({
        client_name: String(client_name).trim(),
        phone: String(phone).trim(),
        whatsapp: whatsapp ? String(whatsapp).trim() : null,
        service_id: service.id,
        service_name: service.name,
        price: service.price,
        date,
        start_time,
        end_time: minToTime(endMin),
        status: "confirmed",
        comment: comment ? String(comment).trim() : "",
      })
      .select()
      .single();

    if (insErr) {
      // 23P01 = exclusion_violation → the DB itself caught a double-booking race
      if ((insErr as any).code === "23P01") {
        return json({ error: "SLOT_TAKEN" }, 409);
      }
      throw insErr;
    }

    // ---- optional Telegram notification (best-effort, never blocks the response) ----
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
    if (botToken && chatId) {
      const text =
        `Новая запись\n` +
        `Услуга: ${service.name}\n` +
        `Дата: ${date} ${start_time}\n` +
        `Клиент: ${client_name}\n` +
        `Телефон: ${phone}`;
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }).catch((e) => console.error("Telegram notify failed:", e));
    }

    return json({ booking }, 201);
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
