require('dotenv').config();
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const OpenAI = require('openai');
const fs = require('fs');
const pino = require('pino');

// ----------------------
// CONFIGURAÇÕES
// ----------------------
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.2-3b-preview';

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
  const authFolder = './tokens';
  
  // Criar pasta de autenticação se não existir
  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Bot', 'Chrome', '1.0.0'],
  });

  // Evento: QR Code
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeData = qr;
      console.log('[QR] QR Code gerado - acesse /qr para visualizar');
    }

    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      console.log('[STATUS] Conexão fechada. Reconectando:', shouldReconnect);
      
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      isConnected = true;
      qrCodeData = null;
      console.log('[STATUS] Bot conectado com sucesso');
    }
  });

  // Salvar credenciais quando atualizadas
  sock.ev.on('creds.update', saveCreds);

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