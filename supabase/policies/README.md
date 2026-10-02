# RLS policies

Policies live in `supabase/migrations/*_init.sql`.

After applying migrations, in Supabase Dashboard → **Settings → API → Exposed schemas**, ensure `app` is **not** exposed to the Data API. Clients talk to the Node API only.
