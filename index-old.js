require('dotenv').config();
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { AzureOpenAI } = require("openai");

// === CONFIGURAÇÕES AZURE ===
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_TTS_API_KEY = process.env.AZURE_TTS_API_KEY;
const AZURE_REGION = process.env.AZURE_REGION;
const AZURE_TTS_URL = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const DEPLOYMENT_NAME = process.env.DEPLOYMENT_NAME;
const MODEL_NAME = process.env.MODEL_NAME;
const API_VERSION = process.env.API_VERSION;


// === CLIENT AZURE OPENAI ===
const openai = new AzureOpenAI({
  endpoint: AZURE_OPENAI_ENDPOINT,
  apiKey: AZURE_OPENAI_API_KEY,
  deployment: DEPLOYMENT_NAME,
  apiVersion: API_VERSION,
});

// === GERA SSML COM PAUSAS E ÊNFASES ===
function gerarSSML(texto) {
  const pausado = texto.split(/(?<=[.!?])\s+/).map(frase =>
    `<emphasis level='moderate'>${frase.trim()}</emphasis><break time='400ms'/>`
  ).join('\n');

  return `
<speak version='1.0' xml:lang='pt-BR'>
  <voice name='pt-BR-FranciscaNeural'>
    <prosody rate='-5%' pitch='+2%'>
      ${pausado}
    </prosody>
  </voice>
</speak>`;
}

// === GERA ÁUDIO TTS COM SSML ===
async function gerarAudio(texto, outputPath) {
  const ssml = gerarSSML(texto);
  const response = await axios.post(AZURE_TTS_URL, ssml, {
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_TTS_API_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3',
      'User-Agent': 'NodeTTSClient'
    },
    responseType: 'arraybuffer'
  });

  fs.writeFileSync(outputPath, response.data);
  return outputPath;
}

async function gerarRespostaIA(perguntaDoUsuario) {
  const response = await openai.chat.completions.create({
    messages: [
      { role: "system", content: "Você é um assistente simpático e deve levar em consideração que o texto será tranfigurado para audio então a resposta não deve ter foratações tudo deve ser escrtio sem simbulos, então seja claro e objetivo. Responda sempre de forma útil, com frases simples e fáceis de entender." },
      { role: "user", content: perguntaDoUsuario }
    ],
    max_tokens: 800,
    temperature: 1,
    top_p: 1,
    model: MODEL_NAME
  });

  return response.choices[0].message.content;
}

// === INICIAR BOT WHATSAPP ===
wppconnect.create({
  session: 'voz_bot',
  headless: true, // parametro que inica o navegador em modo invisivel - true sem interface grafica / false com interface grafica
  useChrome: false,
}).then(client => {
  console.log('Bot iniciado e aguardando mensagens...');

  client.onMessage(async message => {
    try {
      if (!message.isGroupMsg && message.type === 'chat') {
        const textoRecebido = message.body;
        console.log(`Pergunta recebida: ${textoRecebido}`);

        // 1. GERA RESPOSTA DA IA
        const respostaIA = await gerarRespostaIA(textoRecebido);
        console.log(`Resposta da IA: ${respostaIA}`);

        // 2. GERA ÁUDIO DA RESPOSTA
        const audioPath = path.join(__dirname, `resposta.mp3`);
        await gerarAudio(respostaIA, audioPath);

        // 3. ENVIA ÁUDIO COMO PTT
        await client.sendPtt(message.from, audioPath);
        console.log(`Áudio enviado para ${message.from}`);
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err.message);
    }
  });
}).catch(error => {
  console.error('Falha ao iniciar o bot:', error.message);
});
