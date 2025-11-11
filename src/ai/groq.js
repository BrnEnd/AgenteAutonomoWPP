const OpenAI = require('openai');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const groqClient = GROQ_API_KEY
  ? new OpenAI({
      apiKey: GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1'
    })
  : null;

const BASE_SYSTEM_PROMPT =
  'Você é um assistente virtual brasileiro simpático e prestativo. ' +
  'Responda de forma clara, direta e natural, como se estivesse conversando pelo WhatsApp. ' +
  'Use português brasileiro, seja objetivo e evite respostas muito longas.';

async function generateGroqResponse({ userMessage, context, logger = console }) {
  if (!groqClient) {
    logger.error('[GROQ] Client não configurado. Verifique a GROQ_API_KEY.');
    return 'Desculpe, não consigo responder no momento por uma falha de configuração.';
  }

  try {
    const messages = [
      { role: 'system', content: context ? `${BASE_SYSTEM_PROMPT}\n\nContexto adicional:\n${context}` : BASE_SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ];

    logger.debug?.('[GROQ] Enviando requisição para Groq...');

    const response = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 0.9
    });

    const content = response?.choices?.[0]?.message?.content;

    return (content || 'Desculpe, não consegui gerar uma resposta agora.')
      .replace(/[*_`#<>~]/g, '')
      .trim();
  } catch (error) {
    logger.error('[GROQ] Erro ao chamar Groq:', error.message);

    if (error.status === 429) {
      return 'Desculpe, estou recebendo muitas mensagens. Aguarde alguns segundos.';
    }

    if (error.status === 401) {
      return 'Erro de configuração com a Groq API.';
    }

    return 'Desculpe, estou com problemas técnicos no momento.';
  }
}

module.exports = {
  generateGroqResponse,
  GROQ_MODEL
};
