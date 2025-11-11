# Bot de Voz com Azure OpenAI e WppConnect

Este projeto integra o **Azure OpenAI** e o **Azure Text-to-Speech (TTS)** com o **WppConnect**, criando um assistente de voz automático para WhatsApp.  
Ao receber uma mensagem de texto, o bot gera uma resposta com IA, converte para áudio e envia de volta como mensagem de voz (PTT).

---


## 1. Pré-requisitos

Antes de iniciar, verifique se o ambiente atende aos seguintes requisitos:

- **Node.js 18 ou superior**
- **Google Chrome ou Chromium** instalado (utilizado pelo WppConnect)


---

## 2. Instalar dependências

Instale as bibliotecas necessárias:

```bash
npm install
```

As principais dependências são:
- `@wppconnect-team/wppconnect` – integração com WhatsApp Web  
- `axios` – comunicação com as APIs do Azure  
- `openai` – SDK oficial da Azure OpenAI  
- `dotenv` – leitura das variáveis de ambiente  
- `fs-extra` e `path` – manipulação de arquivos e diretórios  

---

## 3. Configuração do arquivo `.env`

Crie o arquivo `.env` na raiz do projeto (ou copie o exemplo):

```bash
cp .env.example .env
```

Preencha as variáveis com as credenciais do Azure:

```env
AZURE_OPENAI_API_KEY=sua_chave_aqui
AZURE_TTS_API_KEY=sua_chave_aqui
AZURE_OPENAI_ENDPOINT=https://seuendpoint.openai.azure.com/
AZURE_REGION=brazilsouth
DEPLOYMENT_NAME=gpt-4o-mini
MODEL_NAME=gpt-4o-mini
API_VERSION=2024-04-01-preview
SESSION_NAME=voz_bot
```

---

## 4. Executar o projeto

Execute o comando abaixo para iniciar o bot:

```bash
node index.js
```

Ao rodar, o terminal exibirá um **QR Code**.  
No celular, abra o WhatsApp e escaneie o código.

> É recomendável usar um numero de WhatsApp de teste, para evitar que o bot envie mensagens para contatos reais(se conectar no whatsApp de uso pessoal isso irá acontecer para todas as conversar pendentes).

---

## 5. Como funciona

1. O bot aguarda mensagens recebidas (apenas conversas privadas).  
2. Ao receber um texto:
   - Gera uma resposta usando **IA**.  
   - Converte o texto em áudio com **Azure Text-to-Speech**.  
   - Envia o áudio como **mensagem de voz (PTT)**.

O arquivo `resposta.mp3` é sobrescrito a cada nova interação.

---

## 7. Interface do WhatsApp

Por padrão, o WppConnect roda em modo **headless**, sem abrir a janela do navegador.

Se quiser visualizar a interface do WhatsApp Web, altere a configuração no `index.js`:

```js
headless: false,
```

Isso facilita a depuração e o acompanhamento do comportamento do bot.

---

## 8. Estrutura do projeto

```
AssistentePorFala/
├── index.js
├── .env
├── .env.example
├── package.json
└── resposta.mp3
```

---

## 9. Boas práticas para testes

- Use um número separado para testes para não ter respostas indesejadas kkk.    

---
