require('dotenv').config();
const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const OpenAI = require('openai');

// ----------------------
// CONFIGURAÇÕES
// ----------------------
const PORT = process.env.PORT || 3000;

// GROQ API - TOTALMENTE GRATUITO
const GROQ_API_KEY = process.env.GROQ_API_KEY; // Pegar em https://console.groq.com
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.2-3b-preview'; 
// Modelos disponíveis: llama-3.2-3b-preview, llama-3.1-8b-instant, mixtral-8x7b-32768

const groq = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

// ----------------------
// EXPRESS API (QR CODE)
// ----------------------
const app = express();
app.use(express.json());

let clientInstance = null;
let qrCodeData = null;
let isConnected = false;

// Endpoint para verificar status
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    hasQR: !!qrCodeData,
    timestamp: new Date(),
    model: GROQ_MODEL
  });
});

// Endpoint para obter QR Code
app.get('/qr', (req, res) => {
  if (isConnected) {
    return res.json({ message: 'Bot já conectado!', connected: true });
  }
  
  if (!qrCodeData) {
    return res.status(404).json({ error: 'QR Code ainda não gerado. Aguarde...' });
  }
  
  res.json({ qr: qrCodeData, connected: false });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    provider: 'Groq (Free)',
    model: GROQ_MODEL
  });
});

// Endpoint de teste da IA
app.post('/test-ai', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await gerarRespostaIA(message || 'Olá, como você está?');
    res.json({ response, model: GROQ_MODEL });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
  console.log(`📱 QR Code: http://localhost:${PORT}/qr`);
  console.log(`🤖 Provider: Groq (Free)`);
  console.log(`🧠 Modelo: ${GROQ_MODEL}`);
});

// ----------------------
// FUNÇÃO IA COM GROQ
// ----------------------
async function gerarRespostaIA(perguntaDoUsuario) {
  try {
    const systemPrompt =
      "Você é um assistente virtual brasileiro simpático e prestativo. " +
      "Responda de forma clara, direta e natural, como se estivesse conversando pelo WhatsApp. " +
      "Use português brasileiro, seja objetivo e evite respostas muito longas. " +
      "Não use formatações especiais, símbolos ou emojis em excesso.";

    console.log('🤖 Consultando Groq AI...');
    
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: perguntaDoUsuario }
      ],
      temperature: 0.7,
      max_tokens: 500,
      top_p: 0.9,
      // Groq é MUITO rápido, não precisa ajustar stream
    });

    const content = response?.choices?.[0]?.message?.content || 
                    "Desculpe, não consegui gerar uma resposta agora.";
    
    // Limpar formatação para WhatsApp
    return content
      .replace(/[*_`#<>~]/g, '') // Remove markdown
      .replace(/\n{3,}/g, '\n\n') // Max 2 quebras de linha
      .trim();
      
  } catch (error) {
    console.error('❌ Erro ao chamar Groq:', error.message);
    
    // Tratamento de erros específicos
    if (error.status === 429) {
      return "Desculpe, estou recebendo muitas mensagens. Aguarde alguns segundos e tente novamente.";
    }
    
    if (error.status === 401) {
      console.error('⚠️ GROQ_API_KEY inválida! Configure no .env');
      return "Erro de configuração. Por favor, contate o administrador.";
    }
    
    return "Desculpe, estou com problemas técnicos no momento. Tente novamente em instantes.";
  }
}

// ----------------------
// INICIAR BOT WHATSAPP
// ----------------------
console.log('🤖 Iniciando bot WhatsApp com Groq AI...');

wppconnect.create({
  session: 'groq_bot',
  headless: true,
  useChrome: false,
  autoClose: 60000,
  logQR: false,
  
  statusFind: (statusSession, session) => {
    console.log(`📊 Status: ${statusSession}`);
    
    if (statusSession === 'qrReadSuccess') {
      isConnected = true;
      qrCodeData = null;
      console.log('✅ QR Code escaneado com sucesso!');
    }
    
    if (statusSession === 'isLogged') {
      isConnected = true;
      console.log('✅ Bot conectado e pronto!');
    }
    
    if (statusSession === 'notLogged') {
      isConnected = false;
      console.log('⚠️ Aguardando login...');
    }
  },
  
  catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
    console.log(`📱 QR Code gerado (tentativa ${attempts}/${5})`);
    qrCodeData = base64Qr;
  },
  
}).then(client => {
  clientInstance = client;
  isConnected = true;
  console.log('✅ Bot iniciado e aguardando mensagens...');

  // Listener de mensagens
  client.onMessage(async message => {
    try {
      // Apenas mensagens privadas de texto
      if (!message.isGroupMsg && message.type === 'chat') {
        const textoRecebido = message.body?.trim() || '';
        if (!textoRecebido) return;

        console.log(`\n📩 Mensagem de ${message.from}:`);
        console.log(`   "${textoRecebido}"`);

        // Indicador de digitação
        await client.startTyping(message.from);

        // Gerar resposta IA (Groq é super rápido!)
        const startTime = Date.now();
        const respostaIA = await gerarRespostaIA(textoRecebido);
        const responseTime = Date.now() - startTime;
        
        console.log(`🤖 Resposta gerada em ${responseTime}ms:`);
        console.log(`   "${respostaIA.substring(0, 100)}${respostaIA.length > 100 ? '...' : ''}"`);

        // Enviar resposta
        await client.sendText(message.from, respostaIA);
        console.log(`✅ Mensagem enviada!\n`);

        // Parar indicador de digitação
        await client.stopTyping(message.from);
      }
    } catch (err) {
      console.error('❌ Erro ao processar mensagem:', err?.message || err);
      
      // Tentar enviar mensagem de erro ao usuário
      try {
        await client.sendText(
          message.from, 
          'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.'
        );
      } catch (sendError) {
        console.error('❌ Não foi possível enviar mensagem de erro');
      }
    }
  });

  // Listener de estado da conexão
  client.onStateChange(state => {
    console.log(`🔄 Estado alterado: ${state}`);
    
    if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
      isConnected = false;
      console.log('⚠️ Conexão perdida. Tentando reconectar...');
      client.useHere();
    }
  });

  // Listener de ACK (confirmação de leitura)
  client.onAck(ack => {
    const status = {
      '-1': '❌ Erro',
      '0': '⏳ Aguardando',
      '1': '✓ Enviado',
      '2': '✓✓ Recebido',
      '3': '✓✓ Lido'
    };
    console.log(`📬 Status: ${status[ack.ack] || ack.ack}`);
  });

}).catch(error => {
  console.error('❌ Falha ao iniciar o bot:', error?.message || error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando bot gracefully...');
  if (clientInstance) {
    await clientInstance.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recebido SIGTERM, encerrando...');
  if (clientInstance) {
    await clientInstance.close();
  }
  process.exit(0);
});