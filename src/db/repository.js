const { supabaseClient, isSupabaseConfigured } = require('./supabase');

function logSupabaseError(operation, error) {
  console.error(`[SUPABASE] Falha ao ${operation}:`, error.message || error);
}

async function upsertSession({ sessionId, displayName, context, status, tokensPath, autoRestart = true, lastQr = null }) {
  if (!isSupabaseConfigured()) return null;

  const payload = {
    session_id: sessionId,
    display_name: displayName || sessionId,
    context,
    status,
    tokens_path: tokensPath,
    auto_restart: autoRestart,
    last_qr: lastQr,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from('sessions')
    .upsert(payload, { onConflict: 'session_id' });

  if (error) {
    logSupabaseError('salvar sessão', error);
  }
}

async function updateSessionStatus(sessionId, status, extra = {}) {
  if (!isSupabaseConfigured()) return null;

  const payload = {
    status,
    updated_at: new Date().toISOString(),
    ...extra
  };

  const { error } = await supabaseClient
    .from('sessions')
    .update(payload)
    .eq('session_id', sessionId);

  if (error) {
    logSupabaseError('atualizar status da sessão', error);
  }
}

async function recordMessage({ sessionId, direction, remoteJid, body, metadata }) {
  if (!isSupabaseConfigured()) return null;

  const { error } = await supabaseClient
    .from('messages')
    .insert({
      session_id: sessionId,
      direction,
      remote_jid: remoteJid,
      body,
      metadata: metadata || {}
    });

  if (error) {
    logSupabaseError('registrar mensagem', error);
  }
}

async function recordEvent({ sessionId, type, payload }) {
  if (!isSupabaseConfigured()) return null;

  const { error } = await supabaseClient
    .from('events')
    .insert({
      session_id: sessionId,
      type,
      payload: payload || {}
    });

  if (error) {
    logSupabaseError('registrar evento', error);
  }
}

async function updateSessionContext(sessionId, context) {
  if (!isSupabaseConfigured()) return null;

  const { error } = await supabaseClient
    .from('sessions')
    .update({ context, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId);

  if (error) {
    logSupabaseError('atualizar contexto da sessão', error);
  }
}

module.exports = {
  upsertSession,
  updateSessionStatus,
  recordMessage,
  recordEvent,
  updateSessionContext
};
