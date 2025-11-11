require('dotenv').config();
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const OpenAI = require('openai');
const fs = require('fs');
const pino = require('pino');

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
// EXPRESS API (QR CODE)
// ----------------------
const app = express();
app.use(express.json());

let qrCodeData = null;
let isConnected = false;
let sock = null;

app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    hasQR: !!qrCodeData,
    timestamp: new Date()
  });
});

app.get('/qr', (req, res) => {
  if (isConnected) {
    return res.json({ message: 'Bot já conectado', connected: true });
  }
  
  if (!qrCodeData) {
    return res.status(404).json({ error: 'QR Code ainda não gerado' });
  }
  
  res.json({ qr: qrCodeData, connected: false });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    provider: 'Groq (Free)',
    model: GROQ_MODEL,
    library: 'Baileys'
  });
});

// Endpoint para limpar sessão (útil para debug)
app.post('/reset', async (req, res) => {
  try {
    const fs = require('fs');
    const authFolder = './tokens';
    
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
      console.log('[RESET] Sessão limpa com sucesso');
    }
    
    res.json({ success: true, message: 'Sessão limpa. Reinicie o bot.' });
    
    // Reiniciar conexão
    setTimeout(() => {
      process.exit(0); // Railway vai reiniciar automaticamente
    }, 1000);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[API] Rodando na porta ${PORT}`);
  console.log(`[API] QR Code: http://localhost:${PORT}/qr`);
  console.log(`[API] Provider: Groq (Free)`);
  console.log(`[API] Modelo: ${GROQ_MODEL}`);
  console.log(`[API] Library: Baileys (lightweight)`);
});

// ----------------------
// FUNÇÃO IA COM GROQ
// ----------------------
async function gerarRespostaIA(perguntaDoUsuario) {
  try {
    const systemPrompt =
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
// INICIAR BOT WHATSAPP (BAILEYS)
// ----------------------
async function connectToWhatsApp() {
  console.log('[DEBUG] ========================================');
  console.log('[DEBUG] Iniciando função connectToWhatsApp()');
  console.log('[DEBUG] ========================================');

  const authFolder = './tokens';

  // Criar pasta de autenticação se não existir
  if (!fs.existsSync(authFolder)) {
    console.log('[DEBUG] Pasta tokens não existe, criando...');
    fs.mkdirSync(authFolder, { recursive: true });
    console.log('[DEBUG] Pasta tokens criada');
  } else {
    console.log('[DEBUG] Pasta tokens já existe');
    const files = fs.readdirSync(authFolder);
    console.log('[DEBUG] Arquivos em tokens:', files.length > 0 ? files : 'nenhum');
  }

  console.log('[DEBUG] Carregando auth state...');
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  console.log('[DEBUG] Auth state carregado');

  // Verificar se há credenciais mas podem estar corrompidas/expiradas
  const hasCredentials = state.creds?.registered;
  if (hasCredentials) {
    console.log('[DEBUG] ✓ Credenciais encontradas - tentando reconectar sessão existente');
  } else {
    console.log('[DEBUG] ℹ️  Nenhuma credencial válida - será gerado novo QR Code');
  }

  // Buscar versão mais recente do WhatsApp Web
  console.log('[DEBUG] Buscando versão mais recente do WhatsApp Web...');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log('[DEBUG] Versão do WA Web:', version.join('.'), '- Latest:', isLatest);

  console.log('[DEBUG] Criando socket do WhatsApp...');
  console.log('[DEBUG] Auth state:', state.creds ? 'Credenciais existentes' : 'Sem credenciais');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }), // Voltando para silent para reduzir ruído
    // Usar a versão oficial mais recente
    version,
    // Configuração de browser mais realista e atualizada
    browser: ['Chrome (Linux)', 'Chrome', '121.0.0.0'],
    // Timeouts mais generosos
    defaultQueryTimeoutMs: 60000,
    connectTimeoutMs: 60000,
    qrTimeout: 60000,
    // Configurações otimizadas
    syncFullHistory: false,
    markOnlineOnConnect: false, // Mudado para false para ser mais discreto
    generateHighQualityLinkPreview: false,
    // Retry mais robusto
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
    // getMessage obrigatório
    getMessage: async () => undefined,
  });

  console.log('[DEBUG] Socket criado com sucesso');

  // Evento: QR Code
  sock.ev.on('connection.update', (update) => {
    console.log('[DEBUG] Connection update recebido:', JSON.stringify({
      connection: update.connection,
      hasQR: !!update.qr,
      hasError: !!update.lastDisconnect?.error,
      errorMessage: update.lastDisconnect?.error?.message,
      statusCode: update.lastDisconnect?.error?.output?.statusCode,
      timestamp: new Date().toISOString()
    }, null, 2));

    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeData = qr;
      console.log('[QR] ✓ QR Code gerado - acesse /qr para visualizar');
      console.log('[QR] URL: http://localhost:' + PORT + '/qr');
    }

    // Ignorar updates sem status de conexão (apenas QR updates)
    if (!connection && qr) {
      return;
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log('[STATUS] ✗ Conexão fechada.');

      if (lastDisconnect?.error) {
        console.log('[ERROR] Detalhes do erro:');
        console.log('[ERROR] - Mensagem:', lastDisconnect.error.message);
        console.log('[ERROR] - Status Code:', statusCode);
        console.log('[ERROR] - Stack:', lastDisconnect.error.stack?.split('\n').slice(0, 3).join('\n'));

        const reasonName = Object.keys(DisconnectReason).find(
          key => DisconnectReason[key] === statusCode
        );
        console.log('[ERROR] - DisconnectReason:', reasonName || 'unknown');
      }

      // Se a sessão expirou ou foi desconectada (401 ou loggedOut)
      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        console.log('[STATUS] ⚠️  Sessão expirada/desconectada. Limpando tokens...');

        // Limpar pasta tokens
        try {
          if (fs.existsSync(authFolder)) {
            const files = fs.readdirSync(authFolder);
            files.forEach(file => {
              fs.unlinkSync(`${authFolder}/${file}`);
            });
            console.log('[STATUS] ✓ Tokens limpos com sucesso');
          }
        } catch (error) {
          console.error('[ERROR] Erro ao limpar tokens:', error.message);
        }

        // Aguardar e reconectar para gerar novo QR
        console.log('[STATUS] ⟳ Gerando novo QR Code em 3 segundos...');
        setTimeout(() => {
          connectToWhatsApp();
        }, 3000);
      } else if (shouldReconnect) {
        console.log('[STATUS] ⟳ Tentando reconectar em 5 segundos...');
        setTimeout(() => {
          connectToWhatsApp();
        }, 5000);
      } else {
        console.log('[STATUS] ⚠️  Conexão encerrada permanentemente.');
      }
    } else if (connection === 'open') {
      isConnected = true;
      qrCodeData = null;
      console.log('[STATUS] ✓ Bot conectado com sucesso ao WhatsApp!');
    } else if (connection === 'connecting') {
      console.log('[STATUS] ⟳ Conectando ao WhatsApp...');
    } else {
      console.log('[DEBUG] Status desconhecido:', connection);
    }
  });

  // Salvar credenciais quando atualizadas
  sock.ev.on('creds.update', async () => {
    console.log('[DEBUG] Credenciais atualizadas - salvando...');
    await saveCreds();
    console.log('[DEBUG] Credenciais salvas com sucesso');
  });

  // Evento: Mensagens
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Ignorar mensagens próprias e de grupos
      if (msg.key.fromMe || msg.key.remoteJid.includes('@g.us')) continue;

      const text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || '';

      if (!text.trim()) continue;

      const sender = msg.key.remoteJid;

      console.log(`\n[MESSAGE] Mensagem de ${sender}:`);
      console.log(`[MESSAGE] "${text}"`);

      try {
        // Indicador de digitação
        await sock.sendPresenceUpdate('composing', sender);

        // Gerar resposta IA
        const startTime = Date.now();
        const respostaIA = await gerarRespostaIA(text);
        const responseTime = Date.now() - startTime;

        console.log(`[RESPONSE] Resposta gerada em ${responseTime}ms:`);
        console.log(`[RESPONSE] "${respostaIA.substring(0, 100)}${respostaIA.length > 100 ? '...' : ''}"`);

        // Enviar resposta
        await sock.sendMessage(sender, { text: respostaIA });
        console.log(`[SENT] Mensagem enviada\n`);

        // Parar indicador de digitação
        await sock.sendPresenceUpdate('paused', sender);

      } catch (error) {
        console.error('[ERROR] Erro ao processar mensagem:', error.message);
        
        try {
          await sock.sendMessage(sender, { 
            text: 'Desculpe, ocorreu um erro. Tente novamente.' 
          });
        } catch (sendError) {
          console.error('[ERROR] Não foi possível enviar mensagem de erro');
        }
      }
    }
  });
}

// Iniciar conexão
console.log('[BOT] Iniciando bot WhatsApp com Baileys...');
connectToWhatsApp();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[SHUTDOWN] Encerrando bot...');
  if (sock) {
    await sock.logout();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[SHUTDOWN] Recebido SIGTERM, encerrando...');
  if (sock) {
    await sock.logout();
  }
  process.exit(0);
});