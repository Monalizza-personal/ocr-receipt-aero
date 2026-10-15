-- ==============================================================================
-- InstaSheet Expenses Tracker - Supabase SQL Schema
-- Project: https://jxuiggmifepmlpiculms.supabase.co
-- Features: Receipts, Line Items, Custom Categories, Product Choices, and RLS
-- ==============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table (Linked to Supabase Auth)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  currency_preference text default 'SAR',
  theme_preference text default 'light',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger to automatically create a profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. Receipts Table (Matches ExpenseReceipt in localStorage)
-- ------------------------------------------------------------------------------
create table if not exists public.receipts (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
  original_store_name text,
  store_address text,
  original_store_address text,
  store_phone text,
  tax_id text,
  invoice_no text,
  upload_ref_no text, -- Bundle/upload reference number (e.g. UPL-20261007-001)
  date date not null default current_date,
  time text,
  currency text not null default 'SAR',
  subtotal numeric(12, 2) not null default 0,
  vat_total numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null default 0,
  category text not null default 'Miscellaneous',
  payment_method text not null default 'Cash',
  image_url text,
  thumbnail_url text,
  is_pdf boolean default false,
  is_translated boolean default false,
  notes text,
  uploaded_at timestamptz default now() not null, -- Actual upload timestamp (ISO UTC)
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 3. Expense Line Items Table (Matches ExpenseItem)
-- ------------------------------------------------------------------------------
create table if not exists public.expense_items (
  id text primary key default gen_random_uuid()::text,
  receipt_id text not null references public.receipts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  original_description text,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  vat_amount numeric(12, 2) default 0,
  total_amount numeric(12, 2) not null default 0,
  has_vat boolean default true,
  category text,
  product_choice text,
  upload_ref_no text,
  created_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 4. Custom User Categories (Matches aistudio_custom_categories)
-- ------------------------------------------------------------------------------
create table if not exists public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now() not null,
  unique (user_id, name)
);

-- ------------------------------------------------------------------------------
-- 5. Custom User Product Choices (Matches aistudio_custom_product_choices)
-- ------------------------------------------------------------------------------
create table if not exists public.custom_product_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now() not null,
  unique (user_id, name)
);

-- ------------------------------------------------------------------------------
-- 6. Performance Indexes
-- ------------------------------------------------------------------------------
create index if not exists idx_receipts_user_date on public.receipts (user_id, date desc);
create index if not exists idx_receipts_upload_ref on public.receipts (user_id, upload_ref_no);
create index if not exists idx_expense_items_receipt_id on public.expense_items (receipt_id);
create index if not exists idx_expense_items_user_id on public.expense_items (user_id);
create index if not exists idx_custom_categories_user on public.custom_categories (user_id);
create index if not exists idx_custom_choices_user on public.custom_product_choices (user_id);

-- ------------------------------------------------------------------------------
-- 7. Row Level Security (RLS) Configuration
-- Each authenticated user can only view, create, edit, and delete their own records.
-- ------------------------------------------------------------------------------

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.receipts enable row level security;
alter table public.expense_items enable row level security;
alter table public.custom_categories enable row level security;
alter table public.custom_product_choices enable row level security;

-- Profiles Policies
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Receipts Policies
drop policy if exists "Users can view their own receipts" on public.receipts;
create policy "Users can view their own receipts"
  on public.receipts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own receipts" on public.receipts;
create policy "Users can insert their own receipts"
  on public.receipts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own receipts" on public.receipts;
create policy "Users can update their own receipts"
  on public.receipts for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own receipts" on public.receipts;
create policy "Users can delete their own receipts"
  on public.receipts for delete
  using (auth.uid() = user_id);

-- Expense Items Policies
drop policy if exists "Users can view their own expense items" on public.expense_items;
create policy "Users can view their own expense items"
  on public.expense_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own expense items" on public.expense_items;
create policy "Users can insert their own expense items"
  on public.expense_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own expense items" on public.expense_items;
create policy "Users can update their own expense items"
  on public.expense_items for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own expense items" on public.expense_items;
create policy "Users can delete their own expense items"
  on public.expense_items for delete
  using (auth.uid() = user_id);

-- Custom Categories Policies
drop policy if exists "Users can view their own custom categories" on public.custom_categories;
create policy "Users can view their own custom categories"
  on public.custom_categories for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own custom categories" on public.custom_categories;
create policy "Users can insert their own custom categories"
  on public.custom_categories for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own custom categories" on public.custom_categories;
create policy "Users can delete their own custom categories"
  on public.custom_categories for delete
  using (auth.uid() = user_id);

-- Custom Product Choices Policies
drop policy if exists "Users can view their own custom choices" on public.custom_product_choices;
create policy "Users can view their own custom choices"
  on public.custom_product_choices for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own custom choices" on public.custom_product_choices;
create policy "Users can insert their own custom choices"
  on public.custom_product_choices for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own custom choices" on public.custom_product_choices;
create policy "Users can delete their own custom choices"
  on public.custom_product_choices for delete
  using (auth.uid() = user_id);
