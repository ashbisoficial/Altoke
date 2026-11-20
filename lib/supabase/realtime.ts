"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase solo para Realtime (canal del mural). No se usa para
 * autenticación: la sesión la lleva Firebase. Se retira con la migración de
 * datos a Firestore.
 */
export function realtimeClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
