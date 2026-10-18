# GPS KOLIPURA — Supabase drawing ledger setup

This ledger is intended to provide atomic, cross-device no-repeat reservations for the 2,500 drawing IDs used by the worksheet engine.

## Required setup
1. Create a Supabase project and enable Supabase Auth anonymous sign-in (or implement a user sign-in flow).
2. Open **SQL Editor** and run `supabase/drawing-ledger.sql`.
3. In the project's API settings, copy the **Project URL** and **publishable/anon key** only. Never put a service-role key in browser code or Git.
4. Add the URL and publishable/anon key to the app's public runtime configuration; the browser must establish a Supabase Auth session before calling the reservation RPC.
5. Test two independent browser contexts reserving concurrently; verify every returned ID is unique, all-or-nothing exhaustion is enforced, and offline mode never claims cross-device uniqueness.

## Safety boundary
- The SQL function serializes reservations and commits all requested IDs in one transaction.
- The table has no direct client table access; only authenticated clients can call the reservation function. The function rejects unauthenticated calls.
- This SQL ledger is not, by itself, a finished frontend integration. Do not merge or deploy until the client uses the ledger for every new and legacy drawing assignment, config/missing-network behavior is explicit, and concurrent/exhaustion/offline tests pass.
- The ledger reserves IDs globally; it does not store student names or worksheet contents.
