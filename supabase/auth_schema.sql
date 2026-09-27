-- 로그인(직원별 아이디·비밀번호) + 휴가 기록 테이블 분리. 2026-09-27 적용.
-- 실제 적용본은 Supabase 마이그레이션 guro_auth_and_leave_records, guro_first_admin_bootstrap,
-- guro_lock_anon_access 와 같다. 새 프로젝트에 다시 만들 때 schema.sql 다음에 실행한다.
--
-- guro_huga_profiles       : 로그인 계정 ↔ 직원(emp_id) ↔ 권한(admin/staff)
-- guro_huga_leave_records  : 휴가 기록 한 건 = 한 행. 직원은 본인 것만, 관리자는 전체
-- guro_huga_state          : 직원·설정 등 공용 데이터. 관리자만 읽기/쓰기
-- guro_state_for_me()      : 직원용 공용 데이터(본인 정보만, 인사·급여·권한 제외)
-- guro_bootstrap_first_admin: 관리자가 없을 때 처음 만든 계정을 첫 직원의 관리자로 연결
-- 계정 생성·비밀번호 초기화는 Edge Function guro-admin-users (supabase/functions) 가 한다.

create table if not exists public.guro_huga_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique check (login_id ~ '^[a-z0-9._-]{3,30}$'),
  emp_id text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.guro_huga_leave_records (
  id text primary key,
  emp_id text not null,
  date date not null,
  type text not null,
  memo text not null default '',
  applied_date date,
  group_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index if not exists guro_huga_leave_records_emp_idx on public.guro_huga_leave_records (emp_id, date);

create or replace function public.guro_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.guro_huga_profiles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.guro_my_emp()
returns text language sql stable security definer set search_path = public as $$
  select emp_id from public.guro_huga_profiles where user_id = auth.uid();
$$;

alter table public.guro_huga_profiles enable row level security;
alter table public.guro_huga_leave_records enable row level security;

create policy guro_profiles_select on public.guro_huga_profiles
  for select to authenticated using (user_id = auth.uid() or public.guro_is_admin());

create policy guro_records_select on public.guro_huga_leave_records
  for select to authenticated using (public.guro_is_admin() or emp_id = public.guro_my_emp());
create policy guro_records_insert on public.guro_huga_leave_records
  for insert to authenticated with check (public.guro_is_admin() or emp_id = public.guro_my_emp());
create policy guro_records_update on public.guro_huga_leave_records
  for update to authenticated using (public.guro_is_admin() or emp_id = public.guro_my_emp())
  with check (public.guro_is_admin() or emp_id = public.guro_my_emp());
create policy guro_records_delete on public.guro_huga_leave_records
  for delete to authenticated using (public.guro_is_admin() or emp_id = public.guro_my_emp());

create or replace function public.guro_state_for_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  full_data jsonb;
  me text := public.guro_my_emp();
begin
  if auth.uid() is null or me is null then
    return null;
  end if;
  select data into full_data from public.guro_huga_state where id = 'main';
  if full_data is null then
    return null;
  end if;
  if public.guro_is_admin() then
    return full_data;
  end if;
  return (full_data - 'hrRecords' - 'auditLogs' - 'perms' - 'orgUnits' - 'records')
    || jsonb_build_object(
      'employees', coalesce((select jsonb_agg(e) from jsonb_array_elements(full_data->'employees') e where e->>'id' = me), '[]'::jsonb),
      'totals', coalesce((select jsonb_object_agg(k, v) from jsonb_each(full_data->'totals') t(k, v) where k like me || '\_%'), '{}'::jsonb),
      'subLeaves', coalesce((select jsonb_agg(s) from jsonb_array_elements(full_data->'subLeaves') s where s->>'empId' = me), '[]'::jsonb),
      'specialLeaves', coalesce((select jsonb_agg(s) from jsonb_array_elements(full_data->'specialLeaves') s where s->>'empId' = me), '[]'::jsonb),
      'records', '[]'::jsonb
    );
end;
$$;
revoke all on function public.guro_state_for_me() from public, anon;
grant execute on function public.guro_state_for_me() to authenticated;

-- 공용 데이터 행: 로그인한 관리자만. 예전의 anon 공개 정책은 제거한다.
drop policy if exists guro_huga_state_select on public.guro_huga_state;
drop policy if exists guro_huga_state_insert on public.guro_huga_state;
drop policy if exists guro_huga_state_update on public.guro_huga_state;
create policy guro_state_admin_select on public.guro_huga_state
  for select to authenticated using (public.guro_is_admin());
create policy guro_state_admin_write on public.guro_huga_state
  for insert to authenticated with check (public.guro_is_admin() and id = 'main');
create policy guro_state_admin_update on public.guro_huga_state
  for update to authenticated using (public.guro_is_admin() and id = 'main') with check (public.guro_is_admin() and id = 'main');

create or replace function public.guro_bootstrap_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  first_emp text;
  login text;
begin
  if exists (select 1 from public.guro_huga_profiles where role = 'admin') then
    return new;
  end if;
  select data->'employees'->0->>'id' into first_emp from public.guro_huga_state where id = 'main';
  login := lower(split_part(coalesce(new.email, ''), '@', 1));
  if first_emp is null or login !~ '^[a-z0-9._-]{3,30}$' then
    return new;
  end if;
  insert into public.guro_huga_profiles (user_id, login_id, emp_id, role)
  values (new.id, login, first_emp, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists guro_bootstrap_first_admin on auth.users;
create trigger guro_bootstrap_first_admin
  after insert on auth.users
  for each row execute function public.guro_bootstrap_first_admin();

alter publication supabase_realtime add table public.guro_huga_leave_records;
