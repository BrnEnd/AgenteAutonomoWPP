require('dotenv').config();
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

// ----------------------
// OPENAI CLIENT -> LOCALAI
// ----------------------
const OpenAI = require('openai');

const LOCALAI_BASE_URL = process.env.LOCALAI_BASE_URL || 'http://localhost:8080/v1';
const LOCALAI_API_KEY = process.env.LOCALAI_API_KEY || 'local-ai'; // qualquer string
const LOCALAI_MODEL = process.env.LOCALAI_MODEL || 'llama-3.2-1b-instruct:q4_k_m';

const openai = new OpenAI({
  apiKey: LOCALAI_API_KEY,
  baseURL: LOCALAI_BASE_URL
});

// ----------------------
// AZURE OPENAI (NÃO USAR AGORA) — COMENTADO
// ----------------------
// const { AzureOpenAI } = require("openai");
// const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
// const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
// const DEPLOYMENT_NAME = process.env.DEPLOYMENT_NAME;
// const MODEL_NAME = process.env.MODEL_NAME;
// const API_VERSION = process.env.API_VERSION;
// const openaiAzure = new AzureOpenAI({
//   endpoint: AZURE_OPENAI_ENDPOINT,
//   apiKey: AZURE_OPENAI_API_KEY,
//   deployment: DEPLOYMENT_NAME,
//   apiVersion: API_VERSION,
// });

// === GERA RESPOSTA VIA LOCALAI ===
async function gerarRespostaIA(perguntaDoUsuario) {
  // Prompt pensado para TTS: sem formatação, sem símbolos estranhos
  const systemPrompt =
    "Você é um assistente simpático. A resposta será convertida para áudio, então evite formatações e símbolos. Seja claro, objetivo e use frases curtas.";

  const res = await openai.chat.completions.create({
    model: LOCALAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: perguntaDoUsuario }
    ],
    // Ajuste fino dependendo do modelo local
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 600
  });

  const content = res?.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta agora.";
  // Sanitização simples para TTS
  return content.replace(/[•*_`#<>~]/g, '').trim();
}

// ----------------------
// INICIAR BOT WHATSAPP
// ----------------------
wppconnect.create({
  session: 'voz_bot',
  headless: true,     // true = sem interface gráfica
  useChrome: false,
}).then(client => {
  console.log('Bot iniciado e aguardando mensagens...');

  client.onMessage(async message => {
    try {
      if (!message.isGroupMsg && message.type === 'chat') {
        const textoRecebido = message.body?.trim() || '';
        if (!textoRecebido) return;

        console.log(`Pergunta recebida: ${textoRecebido}`);

        // 1) Resposta IA (LocalAI)
        const respostaIA = await gerarRespostaIA(textoRecebido);
        console.log(`Resposta da IA: ${respostaIA}`);

        // 2) Enviar mensagem para o Wpp
        await client.sendText(message.from, respostaIA);
        console.log(`Mensagem enviada para ${message.from}`);
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err?.response?.data || err?.message || err);
    }
  });
}).catch(error => {
  console.error('Falha ao iniciar o bot:', error?.message || error);
});

/* ----------------------
   EXTRAS (COMENTADOS)
---------------------- */

// // Caso queira manter também um fallback com Azure OpenAI no futuro:
// async function gerarRespostaIA_Azure(pergunta) {
//   const response = await openaiAzure.chat.completions.create({
//     messages: [
//       { role: "system", content: "Você é um assistente simpático..." },
//       { role: "user", content: pergunta }
//     ],
//     max_tokens: 800,
//     temperature: 1,
//     top_p: 1,
//     model: process.env.MODEL_NAME
//   });
//   return response.choices[0].message.content;
// }
