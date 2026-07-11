create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text,
  price numeric(14,2) not null default 0,
  old_price numeric(14,2) not null default 0,
  rating numeric(3,2) not null default 0,
  badge text,
  note text,
  proof text,
  image_url text,
  product_url text not null,
  featured integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  affiliate_url text not null,
  channel text not null default 'all',
  content_id text,
  content_format text,
  campaign text,
  variant text not null default 'v1',
  sub_id1 text,
  sub_id2 text,
  sub_id3 text,
  sub_id4 text,
  sub_id5 text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.click_events (
  id uuid primary key default gen_random_uuid(),
  product_id text references public.products(id) on delete set null,
  link_id uuid references public.affiliate_links(id) on delete set null,
  channel text not null,
  content_id text not null,
  content_format text,
  campaign text,
  variant text,
  client_hash text,
  ip_hash text,
  user_agent text,
  referrer text,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.conversions (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  product_id text references public.products(id) on delete set null,
  link_id uuid references public.affiliate_links(id) on delete set null,
  click_id uuid references public.click_events(id) on delete set null,
  channel text not null default 'unknown',
  content_id text not null default 'unknown',
  content_format text,
  campaign text,
  variant text,
  order_value numeric(14,2) not null default 0,
  commission numeric(14,2) not null default 0,
  currency text not null default 'VND',
  status text not null default 'pending',
  occurred_at timestamptz not null default now(),
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_click_events_created on public.click_events(created_at desc);
create index if not exists idx_click_events_channel_content on public.click_events(channel,content_id);
create index if not exists idx_click_events_product on public.click_events(product_id);
create index if not exists idx_conversions_occurred on public.conversions(occurred_at desc);
create index if not exists idx_conversions_channel_content on public.conversions(channel,content_id);
create index if not exists idx_conversions_product on public.conversions(product_id);
create index if not exists idx_affiliate_links_lookup on public.affiliate_links(product_id,channel,content_id,is_active);

alter table public.products enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.click_events enable row level security;
alter table public.conversions enable row level security;

revoke all on public.products from anon, authenticated;
revoke all on public.affiliate_links from anon, authenticated;
revoke all on public.click_events from anon, authenticated;
revoke all on public.conversions from anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists links_touch_updated_at on public.affiliate_links;
create trigger links_touch_updated_at before update on public.affiliate_links for each row execute function public.touch_updated_at();
drop trigger if exists conversions_touch_updated_at on public.conversions;
create trigger conversions_touch_updated_at before update on public.conversions for each row execute function public.touch_updated_at();

-- Chạy file seed riêng sau schema nếu muốn đưa 7 sản phẩm hiện tại vào database.
