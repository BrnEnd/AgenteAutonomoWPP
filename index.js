require('dotenv').config();
const express = require('express');
const pino = require('pino');

const WhatsAppSession = require('./src/sessions/WhatsAppSession');
const { GROQ_MODEL } = require('./src/ai/groq');
const { supabaseClient, isSupabaseConfigured } = require('./src/db/supabase');
const { updateSessionStatus } = require('./src/db/repository');

const PORT = process.env.PORT || 3000;
const BASE_TOKENS_PATH = process.env.TOKENS_PATH || './tokens';

const app = express();
app.use(express.json());

const sessions = new Map();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function restoreSessions() {
  if (!isSupabaseConfigured()) {
    logger.warn('[INIT] Supabase não configurado. Nenhuma sessão será restaurada automaticamente.');
    return;
  }

  const { data, error } = await supabaseClient
    .from('sessions')
    .select('session_id, display_name, context, auto_restart')
    .eq('auto_restart', true)
    .in('status', ['connected', 'starting', 'connecting', 'waiting_qr']);

  if (error) {
    logger.error('[INIT] Falha ao consultar sessões no Supabase:', error.message);
    return;
  }

  for (const sessionData of data) {
    const { session_id: sessionId, display_name: displayName, context, auto_restart: autoRestart } = sessionData;

    if (sessions.has(sessionId)) continue;

    logger.info(`[INIT] Restaurando sessão ${sessionId} a partir do Supabase...`);
    const session = new WhatsAppSession(sessionId, {
      displayName,
      context,
      autoRestart,
      baseTokensPath: BASE_TOKENS_PATH,
      logger: pino({ level: process.env.SESSION_LOG_LEVEL || 'info', name: `session-${sessionId}` })
    });

    sessions.set(sessionId, session);

    try {
      await session.start();
    } catch (error) {
      logger.error(`[INIT] Falha ao restaurar sessão ${sessionId}:`, error.message);
      sessions.delete(sessionId);
      await updateSessionStatus(sessionId, 'error', { last_error: error.message });
    }
  }
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    provider: 'Groq (Free)',
    model: GROQ_MODEL,
    library: 'Baileys',
    supabase: isSupabaseConfigured()
  });
});

app.get('/status', (req, res) => {
  res.json({
    total: sessions.size,
    sessions: Array.from(sessions.values()).map((session) => session.getStatus()),
    timestamp: new Date()
  });
});

app.get('/sessions', (req, res) => {
  res.json({ sessions: Array.from(sessions.values()).map((session) => session.getStatus()) });
});

app.post('/sessions', async (req, res) => {
  const { sessionId, displayName, context, autoRestart = true } = req.body || {};

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId é obrigatório.' });
  }

  if (sessions.has(sessionId)) {
    return res.status(409).json({ error: 'Sessão já existe.' });
  }

  const sessionLogger = pino({ level: process.env.SESSION_LOG_LEVEL || 'info', name: `session-${sessionId}` });
  const session = new WhatsAppSession(sessionId, {
    displayName,
    context,
    autoRestart,
    baseTokensPath: BASE_TOKENS_PATH,
    logger: sessionLogger
  });

  sessions.set(sessionId, session);

  try {
    await session.start();
    res.status(201).json({ session: session.getStatus() });
  } catch (error) {
    sessions.delete(sessionId);
    sessionLogger.error('[API] Falha ao iniciar sessão:', error.message);
    await updateSessionStatus(sessionId, 'error', { last_error: error.message });
    res.status(500).json({ error: 'Não foi possível iniciar a sessão.', details: error.message });
  }
});

app.get('/sessions/:id/status', (req, res) => {
  const session = getSession(req.params.id);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada.' });
  }

  res.json({ session: session.getStatus() });
});

app.get('/sessions/:id/qr', (req, res) => {
  const session = getSession(req.params.id);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada.' });
  }

  res.json(session.getQr());
});

app.patch('/sessions/:id', async (req, res) => {
  const session = getSession(req.params.id);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada.' });
  }

  const { context, displayName, autoRestart } = req.body || {};

  if (context !== undefined) {
    await session.setContext(context);
  }

  if (displayName) {
    session.displayName = displayName;
  }

  if (typeof autoRestart === 'boolean') {
    session.autoRestart = autoRestart;
  }

  await updateSessionStatus(session.sessionId, session.status, {
    context: session.context,
    display_name: session.displayName,
    auto_restart: session.autoRestart
  });

  res.json({ session: session.getStatus() });
});

app.delete('/sessions/:id', async (req, res) => {
  const session = getSession(req.params.id);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada.' });
  }

  try {
    await session.stop({ removeTokens: req.query.removeTokens === 'true' });
  } finally {
    sessions.delete(req.params.id);
  }

  res.json({ success: true });
});

app.post('/sessions/:id/send', async (req, res) => {
  const session = getSession(req.params.id);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada.' });
  }

  const { remoteJid, message } = req.body || {};

  if (!remoteJid || !message) {
    return res.status(400).json({ error: 'remoteJid e message são obrigatórios.' });
  }

  try {
    await session.sendMessage(remoteJid, message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  logger.info(`[API] Rodando na porta ${PORT}`);
  logger.info(`[API] Provider: Groq (Free)`);
  logger.info(`[API] Modelo: ${GROQ_MODEL}`);
  logger.info('[API] Use POST /sessions para iniciar uma nova sessão');

  await restoreSessions();
});
