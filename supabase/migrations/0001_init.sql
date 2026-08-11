-- =========================================================================
-- Снежана Утешева — миграция на Supabase (Postgres + RLS)
-- Выполнять в Supabase SQL Editor или через `supabase db push`
-- =========================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist"; -- на будущее, если появится 2-й мастер

-- -------------------------------------------------------------------------
-- 1. ТАБЛИЦЫ
-- -------------------------------------------------------------------------

create type booking_status as enum ('pending','confirmed','cancelled','completed');

create table services (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  name        text not null,
  description text default '',
  price       numeric(10,2) not null check (price >= 0),
  duration    int not null check (duration > 0),   -- минуты
  image       text default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table working_hours (
  day_of_week int primary key check (day_of_week between 0 and 6), -- 0=Вс ... 6=Сб (как JS Date.getDay())
  label       text not null,
  start_time  time,
  end_time    time,
  is_working  boolean not null default true
);

create table breaks (
  id          uuid primary key default gen_random_uuid(),
  day_of_week int check (day_of_week between 0 and 6),  -- NULL = "все дни" (было 'all')
  start_time  time not null,
  end_time    time not null,
  label       text default 'Перерыв'
);

create table blocked_slots (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  reason      text default 'Занято',
  created_at  timestamptz not null default now()
);

create table bookings (
  id           uuid primary key default gen_random_uuid(),
  client_name  text not null check (char_length(trim(client_name)) between 2 and 100),
  phone        text not null,
  whatsapp     text,
  service_id   uuid references services(id) on delete set null,
  service_name text not null,
  price        numeric(10,2) not null default 0,
  date         date not null,
  start_time   time not null,
  end_time     time not null,
  status       booking_status not null default 'pending',
  comment      text default '',
  created_at   timestamptz not null default now(),
  -- служебное поле для EXCLUDE constraint ниже
  during tsrange generated always as (
    tsrange((date + start_time)::timestamp, (date + end_time)::timestamp, '[)')
  ) stored
);

-- быстрый поиск / проверка коллизий
create index idx_bookings_date_time on bookings (date, start_time);

-- ГАРАНТИЯ НА УРОВНЕ БД: нельзя вставить/обновить запись, которая по времени
-- пересекается с уже существующей активной (не отменённой) записью.
-- Это защищает от двойной записи даже при одновременных запросах —
-- сама Postgres-транзакция не даст закоммититься второй, пересекающейся строке.
alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (during with &&)
  where (status <> 'cancelled');

create table reviews (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  text       text not null,
  rating     int not null check (rating between 1 and 5),
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);

create table settings (
  key   text primary key,
  value text
);

-- Список админов. Пароль НИГДЕ не хранится — вход через Supabase Auth,
-- сюда просто заносится uuid пользователя из auth.users, которому разрешён доступ.
create table admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid,               -- null = действие сделал клиент (например, через create-booking)
  action     text not null,      -- INSERT / UPDATE / DELETE
  entity     text not null,      -- имя таблицы
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);

-- служебная таблица для rate limiting в Edge Function create-booking
create table booking_attempts (
  id         bigint generated always as identity primary key,
  ip         text not null,
  created_at timestamptz not null default now()
);
create index idx_booking_attempts_ip_time on booking_attempts (ip, created_at);

-- -------------------------------------------------------------------------
-- 2. ХЕЛПЕР: проверка "текущий пользователь — админ"
-- -------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users au where au.id = auth.uid()
  );
$$;

-- -------------------------------------------------------------------------
-- 3. AUDIT LOG — автоматически через триггеры
--    (записи, услуги, рабочие часы — по требованию п.4 промпта)
-- -------------------------------------------------------------------------

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (admin_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce((case when TG_OP = 'DELETE' then OLD.id else NEW.id end)::text, null),
    case
      when TG_OP = 'DELETE' then to_jsonb(OLD)
      when TG_OP = 'UPDATE' then jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
      else to_jsonb(NEW)
    end
  );
  return coalesce(NEW, OLD);
end;
$$;

create trigger trg_audit_bookings
  after insert or update or delete on bookings
  for each row execute function public.audit_trigger();

create trigger trg_audit_services
  after insert or update or delete on services
  for each row execute function public.audit_trigger();

create trigger trg_audit_working_hours
  after insert or update or delete on working_hours
  for each row execute function public.audit_trigger();

-- -------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -------------------------------------------------------------------------

alter table services         enable row level security;
alter table working_hours    enable row level security;
alter table breaks           enable row level security;
alter table blocked_slots    enable row level security;
alter table bookings         enable row level security;
alter table reviews          enable row level security;
alter table settings         enable row level security;
alter table admin_users      enable row level security;
alter table audit_log        enable row level security;
alter table booking_attempts enable row level security;

-- services: публичное чтение активных услуг, запись — только админ
create policy "services_public_select" on services
  for select using (true);
create policy "services_admin_write" on services
  for all using (is_admin()) with check (is_admin());

-- working_hours: публичное чтение, запись — только админ
create policy "working_hours_public_select" on working_hours
  for select using (true);
create policy "working_hours_admin_write" on working_hours
  for all using (is_admin()) with check (is_admin());

-- reviews: публично видны только visible=true, админ видит и правит всё
create policy "reviews_public_select" on reviews
  for select using (visible = true or is_admin());
create policy "reviews_admin_write" on reviews
  for all using (is_admin()) with check (is_admin());

-- breaks, blocked_slots, settings, audit_log, booking_attempts, admin_users:
-- полностью закрыты от анонимов, доступ только админу.
-- (расчёт слотов для клиента идёт через Edge Function на service_role,
--  минуя RLS, поэтому анониму эти таблицы напрямую не нужны)
create policy "breaks_admin_only" on breaks
  for all using (is_admin()) with check (is_admin());

create policy "blocked_slots_admin_only" on blocked_slots
  for all using (is_admin()) with check (is_admin());

create policy "settings_admin_only" on settings
  for all using (is_admin()) with check (is_admin());

create policy "audit_log_admin_read" on audit_log
  for select using (is_admin());
-- запись в audit_log идёт только через триггер (security definer), прямых insert/update/delete нет

create policy "admin_users_admin_read" on admin_users
  for select using (is_admin());

create policy "booking_attempts_none" on booking_attempts
  for all using (false);
-- эта таблица используется только Edge Function'ом через service_role key,
-- который RLS не проверяет вовсе — политика выше просто закрывает её от всех остальных.

-- bookings: НЕТ политики на INSERT/SELECT/UPDATE/DELETE для anon.
-- Создание записи идёт ИСКЛЮЧИТЕЛЬНО через Edge Function create-booking
-- (использует service_role key, который RLS не проверяет) — это и есть
-- защита от прямой вставки из браузера в обход проверки занятости слота.
-- Админ работает с записями через дашборд, где он аутентифицирован.
create policy "bookings_admin_all" on bookings
  for all using (is_admin()) with check (is_admin());

-- -------------------------------------------------------------------------
-- 5. НАЧАЛЬНЫЕ ДАННЫЕ (перенос текущего DEFAULT_DB из demo-версии)
-- -------------------------------------------------------------------------

insert into services (category, name, description, price, duration, image, active) values
('Ресницы','Ламинирование ресниц','Подчёркивает природную красоту, делает взгляд выразительнее и ухоженнее.',8500,60,'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?q=80&w=600&auto=format&fit=crop',true),
('Брови','Коррекция формы','Подбор идеальной формы с учётом особенностей лица.',3000,30,'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=600&auto=format&fit=crop',true),
('Брови','Окрашивание + коррекция','Насыщенный цвет и идеальная форма для выразительного взгляда.',6000,45,'https://images.unsplash.com/photo-1512207736890-6ffe237ff9c8?q=80&w=600&auto=format&fit=crop',true),
('Комплекс','Ламинирование + коррекция','Комплекс для естественного объёма и идеальной формы.',7000,75,'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?q=80&w=600&auto=format&fit=crop',true),
('Комплекс','Ламинирование + окрашивание + коррекция','Максимальный эффект для идеального взгляда каждый день.',8000,90,'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?q=80&w=600&auto=format&fit=crop',true),
('Дополнительно','Ваксинг','Бережное удаление лишних волосков для гладкой кожи.',500,15,'https://images.unsplash.com/photo-1596704017254-9b121068fb31?q=80&w=600&auto=format&fit=crop',true);

insert into working_hours (day_of_week, label, start_time, end_time, is_working) values
(1,'Понедельник','09:00','19:00',true),
(2,'Вторник','09:00','19:00',true),
(3,'Среда','09:00','19:00',true),
(4,'Четверг','09:00','19:00',true),
(5,'Пятница','09:00','19:00',true),
(6,'Суббота','10:00','16:00',true),
(0,'Воскресенье',null,null,false);

insert into breaks (day_of_week, start_time, end_time, label) values
(null,'13:00','14:00','Обед');

insert into reviews (name, text, rating, visible) values
('Айгерим','Очень аккуратная работа! Брови держат форму уже месяц, выгляжу отдохнувшей каждый день.',5,true),
('Мадина','Ламинирование ресниц — восторг. Взгляд стал совсем другим, спасибо большое!',5,true),
('Алина','Приятная атмосфера, всё по делу, результат превзошёл ожидания.',5,true);

insert into settings (key, value) values
('master_name','Снежана Утешева'),
('phone','+7 707 123 45 67'),
('whatsapp','77071234567'),
('instagram','@snezhana.brows'),
('address','г. Усть-Каменогорск, ул. Пушкина, 12'),
('telegram_chat_id','');   -- заполнить из админки после подключения Telegram-бота (см. README)

-- -------------------------------------------------------------------------
-- 6. Как добавить первого админа (выполнить вручную после первой регистрации):
--
--   1) В Supabase Dashboard → Authentication → Users → Add user
--      (или через supabase.auth.signUp на фронте, потом удалить публичный signUp)
--   2) insert into admin_users (id, email) values ('<uuid пользователя>', '<email>');
-- -------------------------------------------------------------------------
