require('dotenv').config();
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs');
const pino = require('pino');
const db = require('./database/connection');
const queries = require('./database/queries');

// ----------------------
// CONFIGURAÇÕES
// ----------------------
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const groq = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

// ----------------------
// MULTI-SESSÃO: GERENCIAMENTO DE SESSÕES ATIVAS
// ----------------------
// Map para armazenar todas as sessões ativas
// Key: session_name, Value: { sock, sessaoId, clienteId, whatsappNumero, contexto }
const activeSessions = new Map();

// ----------------------
// EXPRESS API
// ----------------------
const app = express();

// Configuração CORS
const corsOptions = {
  origin: [
    'http://localhost:8080',                               // Desenvolvimento local
    'https://front-agente-autonomo.vercel.app'            // Produção Vercel
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    provider: 'Groq (Free)',
    model: GROQ_MODEL,
    library: 'Baileys',
    activeSessions: activeSessions.size,
    timestamp: new Date()
  });
});

// Status geral do sistema
app.get('/status', (req, res) => {
  const sessions = [];
  activeSessions.forEach((session, sessionName) => {
    sessions.push({
      sessionName,
      whatsappNumero: session.whatsappNumero,
      connected: session.connected || false,
      clienteNome: session.clienteNome
    });
  });

  res.json({
    activeSessions: activeSessions.size,
    sessions,
    timestamp: new Date()
  });
});

// ----------------------
// ROTAS CRUD - CLIENTES
// ----------------------

// Criar novo cliente
app.post('/clientes', async (req, res) => {
  try {
    const { nome, email, telefone, contextoArquivo } = req.body;

    if (!nome || !contextoArquivo) {
      return res.status(400).json({ error: 'Nome e contextoArquivo são obrigatórios' });
    }

    const cliente = await queries.createCliente(nome, email, telefone, contextoArquivo);
    res.status(201).json(cliente);
  } catch (error) {
    console.error('[API] Erro ao criar cliente:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Listar todos os clientes
app.get('/clientes', async (req, res) => {
  try {
    const apenasAtivos = req.query.ativos !== 'false';
    const clientes = await queries.getAllClientes(apenasAtivos);
    res.json(clientes);
  } catch (error) {
    console.error('[API] Erro ao listar clientes:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Buscar cliente por ID
app.get('/clientes/:id', async (req, res) => {
  try {
    const cliente = await queries.getClienteById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json(cliente);
  } catch (error) {
    console.error('[API] Erro ao buscar cliente:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar contexto do cliente
app.put('/clientes/:id/contexto', async (req, res) => {
  try {
    const { contextoArquivo } = req.body;
    if (!contextoArquivo) {
      return res.status(400).json({ error: 'contextoArquivo é obrigatório' });
    }

    const cliente = await queries.updateClienteContexto(req.params.id, contextoArquivo);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // Atualizar contexto nas sessões ativas deste cliente
    activeSessions.forEach((session) => {
      if (session.clienteId === parseInt(req.params.id)) {
        session.contexto = contextoArquivo;
        console.log(`[CONTEXTO] Atualizado para sessão ${session.sessionName}`);
      }
    });

    res.json(cliente);
  } catch (error) {
    console.error('[API] Erro ao atualizar contexto:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar dados do cliente
app.put('/clientes/:id', async (req, res) => {
  try {
    const { nome, email, telefone, ativo } = req.body;
    const cliente = await queries.updateCliente(req.params.id, { nome, email, telefone, ativo });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    res.json(cliente);
  } catch (error) {
    console.error('[API] Erro ao atualizar cliente:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Deletar cliente (soft delete)
app.delete('/clientes/:id', async (req, res) => {
  try {
    const cliente = await queries.deleteCliente(req.params.id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // Desconectar todas as sessões deste cliente
    const sessoes = await queries.getSessoesByCliente(req.params.id);
    for (const sessao of sessoes) {
      await destroySession(sessao.session_name);
    }

    res.json({ message: 'Cliente desativado com sucesso', cliente });
  } catch (error) {
    console.error('[API] Erro ao deletar cliente:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Listar sessões de um cliente
app.get('/clientes/:id/sessoes', async (req, res) => {
  try {
    const sessoes = await queries.getSessoesByCliente(req.params.id);
    res.json(sessoes);
  } catch (error) {
    console.error('[API] Erro ao listar sessões:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------
// ROTAS CRUD - SESSÕES
// ----------------------

// Criar nova sessão e iniciar bot
app.post('/sessoes', async (req, res) => {
  try {
    const { clienteId, whatsappNumero } = req.body;

    if (!clienteId || !whatsappNumero) {
      return res.status(400).json({ error: 'clienteId e whatsappNumero são obrigatórios' });
    }

    // Verificar se cliente existe e está ativo
    const cliente = await queries.getClienteById(clienteId);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    if (!cliente.ativo) {
      return res.status(400).json({ error: 'Cliente inativo' });
    }

    // Gerar session_name único
    const sessionName = `session_${whatsappNumero}_${Date.now()}`;

    // Criar sessão no banco
    const sessao = await queries.createSessao(clienteId, whatsappNumero, sessionName);

    res.status(201).json(sessao);
  } catch (error) {
    console.error('[API] Erro criar sessão:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Listar todas as sessões
app.get('/sessoes', async (req, res) => {
  try {
    const { status } = req.query;
    let sessoes;

    if (status) {
      sessoes = await queries.getSessoesByStatus(status);
    } else {
      // Buscar todas (implementar query se necessário)
      const allStatuses = ['conectado', 'desconectado', 'aguardando_qr'];
      sessoes = [];
      for (const st of allStatuses) {
        const s = await queries.getSessoesByStatus(st);
        sessoes.push(...s);
      }
    }

    res.json(sessoes);
  } catch (error) {
    console.error('[API] Erro ao listar sessões:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Buscar sessão por ID
app.get('/sessoes/:id', async (req, res) => {
  try {
    const sessao = await queries.getSessaoById(req.params.id);
    if (!sessao) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    res.json(sessao);
  } catch (error) {
    console.error('[API] Erro ao buscar sessão:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Obter QR Code de uma sessão
app.get('/sessoes/:id/qr', async (req, res) => {
  try {
    const sessao = await queries.getSessaoById(req.params.id);
    if (!sessao) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    if (sessao.status === 'conectado') {
      return res.json({ message: 'Sessão já conectada', connected: true });
    }

    // Se já tem QR code, retorna imediatamente
    if (sessao.qr_code) {
      return res.json({ qr: sessao.qr_code, status: sessao.status });
    }

    // Se não tem QR code, verificar se a sessão está inicializada
    if (!activeSessions.has(sessao.session_name)) {
      initializeSession(parseInt(req.params.id)).catch(error => {
        console.error(`[QR] Erro ao inicializar:`, error.message);
      });
    }

    // Aguardar QR code ser gerado (até 10 segundos)
    const maxAttempts = 10;
    const delayMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const sessaoAtualizada = await queries.getSessaoById(req.params.id);

      if (sessaoAtualizada.qr_code) {
        return res.json({ qr: sessaoAtualizada.qr_code, status: sessaoAtualizada.status });
      }

      if (sessaoAtualizada.status === 'conectado') {
        return res.json({ message: 'Sessão já conectada', connected: true });
      }
    }

    // Timeout
    return res.status(408).json({
      error: 'QR Code não foi gerado a tempo',
      message: 'Tente novamente em alguns instantes'
    });

  } catch (error) {
    console.error('[QR] Erro:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Deletar sessão
app.delete('/sessoes/:id', async (req, res) => {
  try {
    const sessao = await queries.getSessaoById(req.params.id);
    if (!sessao) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    // Desconectar sessão ativa
    await destroySession(sessao.session_name);

    // Deletar do banco
    await queries.deleteSessao(req.params.id);

    res.json({ message: 'Sessão deletada com sucesso' });
  } catch (error) {
    console.error('[API] Erro ao deletar sessão:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------
// ROTAS - LOGS
// ----------------------

// Buscar logs de uma sessão
app.get('/sessoes/:id/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await queries.getLogsBySessao(req.params.id, limit);
    res.json(logs);
  } catch (error) {
    console.error('[API] Erro ao buscar logs:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------
// FUNÇÃO IA COM GROQ (COM CONTEXTO DO BANCO)
// ----------------------
async function gerarRespostaIA(perguntaDoUsuario, contextoCliente) {
  try {
    const systemPrompt = contextoCliente ||
      "Você é um assistente virtual brasileiro simpático e prestativo. " +
      "Responda de forma clara, direta e natural, como se estivesse conversando pelo WhatsApp. " +
      "Use português brasileiro, seja objetivo e evite respostas muito longas.";

    console.log('[GROQ] Consultando Groq AI...');

    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: perguntaDoUsuario }
      ],
      temperature: 0.7,
      max_tokens: 500,
      top_p: 0.9,
    });

    const content = response?.choices?.[0]?.message?.content ||
      "Desculpe, não consegui gerar uma resposta agora.";

    return content.replace(/[*_`#<>~]/g, '').trim();

  } catch (error) {
    console.error('[ERROR] Erro ao chamar Groq:', error.message);

    if (error.status === 429) {
      return "Desculpe, estou recebendo muitas mensagens. Aguarde alguns segundos.";
    }

    if (error.status === 401) {
      console.error('[ERROR] GROQ_API_KEY inválida');
      return "Erro de configuração.";
    }

    return "Desculpe, estou com problemas técnicos no momento.";
  }
}

// ----------------------
// MULTI-SESSÃO: INICIALIZAR SESSÃO DO WHATSAPP
// ----------------------
async function initializeSession(sessaoId) {
  try {
    const sessaoData = await queries.getSessaoById(sessaoId);
    if (!sessaoData) {
      return;
    }

    if (!sessaoData.cliente_ativo) {
      return;
    }

    const { session_name, whatsapp_numero, contexto_arquivo, cliente_id, cliente_nome } = sessaoData;

    // Pasta de autenticação
    const authFolder = `./tokens/${session_name}`;

    // Se status é 'desconectado', deletar tokens para forçar novo QR
    if (sessaoData.status === 'desconectado' && fs.existsSync(authFolder)) {
      try {
        fs.rmSync(authFolder, { recursive: true, force: true });
      } catch (error) {
        console.error(`[INIT] Erro ao deletar tokens:`, error.message);
      }
    }

    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    // Criar socket do Baileys
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      version,
      browser: ['Chrome (Linux)', 'Chrome', '121.0.0.0'],
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      qrTimeout: 60000,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
      getMessage: async () => undefined,
    });

    // Armazenar sessão no Map
    activeSessions.set(session_name, {
      sock,
      sessaoId,
      clienteId: cliente_id,
      whatsappNumero: whatsapp_numero,
      contexto: contexto_arquivo,
      sessionName: session_name,
      clienteNome: cliente_nome,
      connected: false
    });

    // Evento: Connection Update
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          await queries.updateSessaoQRCode(session_name, qr);
        } catch (qrError) {
          console.error(`[QR] Erro ao salvar:`, qrError.message);
        }
      }

      if (connection === 'close') {
        const session = activeSessions.get(session_name);
        if (session) session.connected = false;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        await queries.updateSessaoStatus(sessaoId, 'desconectado', null);

        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          try {
            if (fs.existsSync(authFolder)) {
              fs.rmSync(authFolder, { recursive: true, force: true });
            }
          } catch (error) {
            console.error(`[ERROR] Erro ao limpar tokens:`, error.message);
          }
          setTimeout(() => initializeSession(sessaoId), 3000);
        } else if (shouldReconnect) {
          setTimeout(() => initializeSession(sessaoId), 5000);
        }
      } else if (connection === 'open') {
        const session = activeSessions.get(session_name);
        if (session) session.connected = true;
        await queries.updateSessaoStatus(sessaoId, 'conectado', null);
      }
    });

    // Evento: Credenciais Atualizadas
    sock.ev.on('creds.update', async () => {
      await saveCreds();
    });

    // Evento: Mensagens Recebidas
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      const session = activeSessions.get(session_name);
      if (!session) return;

      for (const msg of messages) {
        // Ignorar mensagens próprias e de grupos
        if (msg.key.fromMe || msg.key.remoteJid.includes('@g.us')) continue;

        const text = msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text || '';

        if (!text.trim()) continue;

        const sender = msg.key.remoteJid;

        try {
          await queries.logMensagem(sessaoId, sender, text, 'recebida');
          await sock.sendPresenceUpdate('composing', sender);

          const startTime = Date.now();
          const respostaIA = await gerarRespostaIA(text, session.contexto);
          const responseTime = Date.now() - startTime;

          await sock.sendMessage(sender, { text: respostaIA });
          await queries.logMensagem(sessaoId, sender, respostaIA, 'enviada', responseTime);
          await sock.sendPresenceUpdate('paused', sender);

        } catch (error) {
          console.error(`[MSG] Erro:`, error.message);
          try {
            await sock.sendMessage(sender, {
              text: 'Desculpe, ocorreu um erro. Tente novamente.'
            });
          } catch (sendError) {
            // Silenciar erro de envio
          }
        }
      }
    });

  } catch (error) {
    console.error(`[INIT] Erro sessão ${sessaoId}:`, error.message);
    try {
      await queries.updateSessaoStatus(sessaoId, 'desconectado', null);
    } catch (statusError) {
      // Silenciar erro
    }
  }
}

// ----------------------
// MULTI-SESSÃO: DESTRUIR SESSÃO
// ----------------------
async function destroySession(sessionName) {
  try {
    const session = activeSessions.get(sessionName);
    if (!session) {
      console.log(`[DESTROY] Sessão ${sessionName} não encontrada no Map`);
      return;
    }

    console.log(`[DESTROY] Encerrando sessão ${sessionName}...`);

    // Fazer logout do Baileys
    if (session.sock) {
      try {
        await session.sock.logout();
      } catch (error) {
        console.error(`[DESTROY] Erro ao fazer logout: ${error.message}`);
      }
    }

    // Remover do Map
    activeSessions.delete(sessionName);

    // Atualizar status no banco
    const sessaoData = await queries.getSessaoBySessionName(sessionName);
    if (sessaoData) {
      await queries.updateSessaoStatus(sessaoData.id, 'desconectado', null);
    }

    console.log(`[DESTROY] ✓ Sessão ${sessionName} encerrada`);
  } catch (error) {
    console.error(`[DESTROY] Erro ao destruir sessão ${sessionName}:`, error.message);
  }
}

// ----------------------
// INICIALIZAÇÃO DO SISTEMA
// ----------------------
async function startBot() {
  console.log('[BOT] Iniciando sistema multi-sessão...');

  // 1. Testar conexão com PostgreSQL
  console.log('[BOT] Testando conexão com PostgreSQL...');
  const dbConnected = await db.testConnection();
  if (!dbConnected) {
    console.error('[BOT] ✗ Falha ao conectar ao banco de dados. Verifique DATABASE_URL');
    process.exit(1);
  }

  // 2. Carregar sessões ativas do banco
  console.log('[BOT] Carregando sessões ativas...');
  try {
    const sessoesAtivas = await queries.getSessoesByStatus('conectado');
    console.log(`[BOT] Encontradas ${sessoesAtivas.length} sessões previamente conectadas`);

    // Inicializar cada sessão
    for (const sessao of sessoesAtivas) {
      console.log(`[BOT] Inicializando sessão: ${sessao.session_name}`);
      await initializeSession(sessao.id);
    }
  } catch (error) {
    console.error('[BOT] Erro ao carregar sessões:', error.message);
  }

  // 3. Iniciar API Express
  app.listen(PORT, () => {
    console.log(`[API] ✓ Servidor rodando na porta ${PORT}`);
    console.log(`[API] Provider: Groq (${GROQ_MODEL})`);
    console.log(`[API] Library: Baileys (Multi-Sessão)`);
    console.log(`[API] Database: PostgreSQL`);
    console.log(`[API] Sessões ativas: ${activeSessions.size}`);
  });
}

// Iniciar sistema
startBot();

// ----------------------
// GRACEFUL SHUTDOWN
// ----------------------
process.on('SIGINT', async () => {
  console.log('\n[SHUTDOWN] Encerrando sistema...');

  // Encerrar todas as sessões
  for (const [sessionName] of activeSessions) {
    await destroySession(sessionName);
  }

  // Fechar pool do banco
  await db.close();

  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[SHUTDOWN] Recebido SIGTERM, encerrando...');

  for (const [sessionName] of activeSessions) {
    await destroySession(sessionName);
  }

  await db.close();

  process.exit(0);
});
