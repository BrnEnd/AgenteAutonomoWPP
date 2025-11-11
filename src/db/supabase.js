const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        'X-Client-Info': 'AgenteAutonomoWPP/1.0.0'
      }
    }
  });
} else {
  console.warn('[SUPABASE] Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas. Operações de persistência serão ignoradas.');
}

function isSupabaseConfigured() {
  return Boolean(supabaseClient);
}

module.exports = {
  supabaseClient,
  isSupabaseConfigured
};
