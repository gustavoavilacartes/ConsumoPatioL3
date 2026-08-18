// ============================================================================
// supabaseConfig.js — Credenciales de conexión al proyecto Supabase
//
// 1. Ve a tu proyecto en https://supabase.com/dashboard
// 2. Settings → API
// 3. Copia "Project URL" y "anon public" key, y pégalas abajo.
//
// La anon key es segura de exponer en el cliente: el acceso real a los
// datos lo controla Row Level Security (RLS), definido en sql/schema.sql.
// ============================================================================

export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU-ANON-KEY-AQUI';
