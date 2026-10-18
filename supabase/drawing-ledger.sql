-- GPS KOLIPURA drawing reservation ledger
-- Run in Supabase SQL Editor before enabling cross-device reservation.
create table if not exists public.gps_drawing_reservations (
  drawing_id integer primary key check (drawing_id >= 0 and drawing_id < 2500),
  worksheet_key text not null,
  reserved_at timestamptz not null default now(),
  reservation_token uuid not null default gen_random_uuid()
);

alter table public.gps_drawing_reservations enable row level security;
revoke all on table public.gps_drawing_reservations from anon, authenticated;

-- Atomic reservation: concurrent devices cannot reserve the same drawing IDs.
create or replace function public.gps_reserve_drawings(p_worksheet_key text, p_count integer default 4)
returns table(drawing_id integer, reservation_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids integer[];
  v_count integer;
  v_outline integer[];
  v_half integer[];
begin
  if p_worksheet_key is null or length(trim(p_worksheet_key)) = 0 or length(p_worksheet_key) > 200 then
    raise exception 'invalid worksheet key';
  end if;
  if p_count < 1 or p_count > 4 then
    raise exception 'reservation count must be between 1 and 4';
  end if;

  -- Deterministic exhaustion handling and transaction-level serialization.
  perform pg_advisory_xact_lock(hashtext('gps-kolipura-drawing-ledger'));
  if p_count <> 4 then
    raise exception 'drawing worksheet reservations require exactly four IDs';
  end if;

  select array_agg(candidate order by candidate)
    into v_outline
    from (
      select candidate
      from generate_series(0, 1249) as candidate
      where not exists (select 1 from public.gps_drawing_reservations r where r.drawing_id = candidate)
      order by candidate
      limit 2
    ) available_outline;

  select array_agg(candidate order by candidate)
    into v_half
    from (
      select candidate
      from generate_series(1250, 2499) as candidate
      where not exists (select 1 from public.gps_drawing_reservations r where r.drawing_id = candidate)
      order by candidate
      limit 2
    ) available_half;

  v_ids := coalesce(v_outline, '{}'::integer[]) || coalesce(v_half, '{}'::integer[]);
  v_count := coalesce(array_length(v_ids, 1), 0);
  if v_count <> p_count then
    raise exception 'DRAWING_LIBRARY_EXHAUSTED';
  end if;

  return query
    insert into public.gps_drawing_reservations(drawing_id, worksheet_key)
    select unnest(v_ids), p_worksheet_key
    returning gps_drawing_reservations.drawing_id, gps_drawing_reservations.reservation_token;
end;
$$;

revoke all on function public.gps_reserve_drawings(text, integer) from public;
grant execute on function public.gps_reserve_drawings(text, integer) to anon, authenticated;
