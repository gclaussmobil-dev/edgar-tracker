import { createClient } from '@supabase/supabase-js';

// Browser Client (für Frontend Realtime Subscriptions)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server Client (für API Routes / Cron Jobs mit erhöhten Rechten)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
