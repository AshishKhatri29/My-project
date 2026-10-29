create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  gender text not null check (gender in ('Male', 'Female', 'Prefer not to say')),
  house_number text not null,
  street text not null,
  area text not null,
  city text not null,
  state text not null,
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;
revoke all on table public.customer_profiles from anon;
revoke all on table public.customer_profiles from authenticated;
grant select, insert, update on table public.customer_profiles to authenticated;

drop policy if exists "Customers can read their own account profile" on public.customer_profiles;
create policy "Customers can read their own account profile"
  on public.customer_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers can insert their own account profile" on public.customer_profiles;
create policy "Customers can insert their own account profile"
  on public.customer_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers can update their own account profile" on public.customer_profiles;
create policy "Customers can update their own account profile"
  on public.customer_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.validate_customer_profile_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_phone text;
begin
  select users.phone
  into verified_phone
  from auth.users as users
  where users.id = (select auth.uid())
    and users.phone_confirmed_at is not null;

  if verified_phone is null or new.phone is distinct from verified_phone then
    raise exception 'Profile phone must match the authenticated, verified Supabase phone number.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.validate_customer_profile_phone() from public, anon, authenticated;

drop trigger if exists validate_customer_profile_phone on public.customer_profiles;
create trigger validate_customer_profile_phone
  before insert or update on public.customer_profiles
  for each row execute function public.validate_customer_profile_phone();
