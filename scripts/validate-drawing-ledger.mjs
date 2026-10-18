import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/drawing-ledger.sql', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../supabase/README.md', import.meta.url), 'utf8');

assert.match(sql, /drawing_id integer primary key check \(drawing_id >= 0 and drawing_id < 2500\)/i);
assert.match(sql, /enable row level security/i);
assert.match(sql, /revoke all on table public\.gps_drawing_reservations from anon, authenticated/i);
assert.match(sql, /if auth\.uid\(\) is null then[\s\S]*AUTHENTICATION_REQUIRED/i);
assert.match(sql, /pg_advisory_xact_lock/i);
assert.match(sql, /generate_series\(0, 1249\)/i);
assert.match(sql, /generate_series\(1250, 2499\)/i);
assert.match(sql, /DRAWING_LIBRARY_EXHAUSTED/i);
assert.match(sql, /revoke all on function public\.gps_reserve_drawings\(text, integer\) from public, anon/i);
assert.match(sql, /grant execute on function public\.gps_reserve_drawings\(text, integer\) to authenticated/i);
assert.match(sql, /p_count <> 4/i);
assert.match(readme, /service[- ]role/i);
assert.match(readme, /signInAnonymously|anonymous sign-in/i);

console.log('PASS: ledger ID bounds, RLS, authenticated RPC, atomic lock, style pools, exhaustion, and key-safety documentation');
