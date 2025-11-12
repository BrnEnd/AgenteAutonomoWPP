# Bot WhatsApp Multi-Sessão com IA (Groq + Baileys)

Sistema de chatbot inteligente integrado ao WhatsApp com suporte a múltiplos clientes e sessões simultâneas. Utiliza Groq AI para respostas contextualizadas e Baileys para conexão com WhatsApp.

---

## 📋 Índice

1. [Características](#características)
2. [Arquitetura](#arquitetura)
3. [Instalação](#instalação)
4. [Configuração](#configuração)
5. [Deploy no Railway](#deploy-no-railway)
6. [API - Documentação para Frontend](#api---documentação-para-frontend)
7. [Fluxo de Uso](#fluxo-de-uso)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Características

- ✅ **Multi-sessão**: Suporte a múltiplos clientes e sessões simultâneas
- ✅ **Contexto dinâmico**: Cada cliente tem seu próprio contexto para a IA
- ✅ **PostgreSQL**: Banco de dados robusto (Railway)
- ✅ **Baileys**: Biblioteca WhatsApp Web leve e eficiente
- ✅ **Groq AI**: Respostas rápidas e gratuitas
- ✅ **Logs de auditoria**: Registro de todas as mensagens
- ✅ **API RESTful**: Interface completa para frontend

---

## 🏗️ Arquitetura

```
┌─────────────┐
│   Frontend  │ ← Interface Web/Mobile
└──────┬──────┘
       │ REST API
┌──────▼──────────────────────────┐
│     Express API (index.js)      │
│  - CRUD Clientes                │
│  - CRUD Sessões                 │
│  - Multi-sessão Manager (Map)   │
└──────┬─────────────┬────────────┘
       │             │
┌──────▼──────┐  ┌──▼──────────┐
│  PostgreSQL │  │   Baileys   │
│  (Railway)  │  │  WhatsApp   │
└─────────────┘  └──┬──────────┘
                    │
              ┌─────▼─────┐
              │  Groq AI  │
              └───────────┘
```

---

## 📦 Instalação

### 1. Clonar repositório

```bash
git clone <repo-url>
cd AgenteAutonomoWPP
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:

```env
PORT=3000
GROQ_API_KEY=sua_chave_groq_aqui
GROQ_MODEL=llama-3.1-8b-instant
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
```

### 4. Criar tabelas no PostgreSQL

Execute o script SQL manualmente no Railway ou via psql:

```bash
psql $DATABASE_URL < database/schema.sql
```

### 5. Rodar localmente

```bash
npm start
```

Ou em modo desenvolvimento:

```bash
npm run dev
```

---

## ⚙️ Configuração

### Groq API Key

1. Acesse: https://console.groq.com/keys
2. Crie uma conta gratuita
3. Gere uma API Key
4. Adicione no `.env`

### PostgreSQL Railway

1. Crie um projeto no Railway
2. Adicione um PostgreSQL Database
3. Copie a `DATABASE_URL`
4. Execute o schema.sql

---

## 🚂 Deploy no Railway

### Método 1: Via GitHub

1. Conecte seu repositório GitHub ao Railway
2. Adicione as variáveis de ambiente:
   - `GROQ_API_KEY`
   - `GROQ_MODEL`
   - `DATABASE_URL` (auto-provisionado)
   - `NODE_ENV=production`
3. Railway detectará automaticamente o `package.json`
4. Execute o schema.sql no PostgreSQL do Railway

### Método 2: Railway CLI

```bash
railway login
railway link
railway up
```

### Executar schema no Railway

**Opção A - Via Railway Dashboard:**
1. Acesse PostgreSQL no Dashboard
2. Abra "Query"
3. Cole o conteúdo de `database/schema.sql`
4. Execute

**Opção B - Via Railway CLI:**
```bash
railway run psql < database/schema.sql
```

---

## 📡 API - Documentação para Frontend

Base URL: `http://localhost:3000` (local) ou `https://seu-app.railway.app` (produção)

### 🔹 Sistema

#### `GET /health`
Health check do sistema

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "provider": "Groq (Free)",
  "model": "llama-3.1-8b-instant",
  "library": "Baileys",
  "activeSessions": 3,
  "timestamp": "2025-11-11T10:00:00.000Z"
}
```

#### `GET /status`
Status de todas as sessões ativas

**Response:**
```json
{
  "activeSessions": 2,
  "sessions": [
    {
      "sessionName": "session_5511999999999_1234567890",
      "whatsappNumero": "5511999999999",
      "connected": true,
      "clienteNome": "Empresa Demo"
    }
  ],
  "timestamp": "2025-11-11T10:00:00.000Z"
}
```

---

### 🔹 Clientes

#### `POST /clientes`
Criar novo cliente

**Body:**
```json
{
  "nome": "Empresa XYZ",
  "email": "contato@xyz.com",
  "telefone": "+5511987654321",
  "contextoArquivo": "Você é um assistente da Empresa XYZ.\nProdutos:\n- Produto A: R$ 100\n- Produto B: R$ 200\nHorário: 9h-18h"
}
```

**Response: 201**
```json
{
  "id": 1,
  "nome": "Empresa XYZ",
  "email": "contato@xyz.com",
  "telefone": "+5511987654321",
  "ativo": true,
  "contexto_arquivo": "...",
  "created_at": "2025-11-11T10:00:00.000Z",
  "updated_at": "2025-11-11T10:00:00.000Z"
}
```

---

#### `GET /clientes`
Listar todos os clientes

**Query Params:**
- `ativos` (opcional): `true` | `false` (default: `true`)

**Response:**
```json
[
  {
    "id": 1,
    "nome": "Empresa XYZ",
    "email": "contato@xyz.com",
    "ativo": true,
    "created_at": "2025-11-11T10:00:00.000Z"
  }
]
```

---

#### `GET /clientes/:id`
Buscar cliente por ID

**Response:**
```json
{
  "id": 1,
  "nome": "Empresa XYZ",
  "email": "contato@xyz.com",
  "telefone": "+5511987654321",
  "ativo": true,
  "contexto_arquivo": "...",
  "created_at": "2025-11-11T10:00:00.000Z",
  "updated_at": "2025-11-11T10:00:00.000Z"
}
```

---

#### `PUT /clientes/:id`
Atualizar dados do cliente

**Body (todos os campos opcionais):**
```json
{
  "nome": "Empresa XYZ Ltda",
  "email": "novo@xyz.com",
  "telefone": "+5511987654321",
  "ativo": true
}
```

**Response:**
```json
{
  "id": 1,
  "nome": "Empresa XYZ Ltda",
  "email": "novo@xyz.com",
  "updated_at": "2025-11-11T11:00:00.000Z"
}
```

---

#### `PUT /clientes/:id/contexto`
Atualizar apenas o contexto (System Prompt da IA)

**Body:**
```json
{
  "contextoArquivo": "Novo contexto para a IA..."
}
```

**Response:**
```json
{
  "id": 1,
  "contexto_arquivo": "Novo contexto...",
  "updated_at": "2025-11-11T11:00:00.000Z"
}
```

**Importante:** Esta rota atualiza automaticamente o contexto em todas as sessões ativas deste cliente!

---

#### `DELETE /clientes/:id`
Desativar cliente (soft delete)

**Response:**
```json
{
  "message": "Cliente desativado com sucesso",
  "cliente": {
    "id": 1,
    "ativo": false
  }
}
```

**Importante:** Todas as sessões ativas deste cliente serão desconectadas!

---

#### `GET /clientes/:id/sessoes`
Listar todas as sessões de um cliente

**Response:**
```json
[
  {
    "id": 1,
    "cliente_id": 1,
    "whatsapp_numero": "5511999999999",
    "session_name": "session_5511999999999_1234567890",
    "status": "conectado",
    "qr_code": null,
    "ultimo_uso": "2025-11-11T10:30:00.000Z",
    "created_at": "2025-11-11T10:00:00.000Z"
  }
]
```

---

### 🔹 Sessões

#### `POST /sessoes`
Criar nova sessão e iniciar bot WhatsApp

**Body:**
```json
{
  "clienteId": 1,
  "whatsappNumero": "5511999999999"
}
```

**Response: 201**
```json
{
  "id": 1,
  "cliente_id": 1,
  "whatsapp_numero": "5511999999999",
  "session_name": "session_5511999999999_1731321600000",
  "status": "desconectado",
  "qr_code": null,
  "created_at": "2025-11-11T10:00:00.000Z"
}
```

**Importante:**
- O bot é iniciado automaticamente
- Aguarde alguns segundos e consulte `/sessoes/:id/qr` para obter o QR Code
- O `whatsappNumero` deve ser único

---

#### `GET /sessoes`
Listar todas as sessões

**Query Params:**
- `status` (opcional): `conectado` | `desconectado` | `aguardando_qr`

**Response:**
```json
[
  {
    "id": 1,
    "cliente_id": 1,
    "whatsapp_numero": "5511999999999",
    "session_name": "session_5511999999999_1234567890",
    "status": "conectado",
    "contexto_arquivo": "...",
    "cliente_nome": "Empresa XYZ",
    "cliente_ativo": true,
    "ultimo_uso": "2025-11-11T10:30:00.000Z"
  }
]
```

---

#### `GET /sessoes/:id`
Buscar sessão por ID

**Response:**
```json
{
  "id": 1,
  "cliente_id": 1,
  "whatsapp_numero": "5511999999999",
  "session_name": "session_5511999999999_1234567890",
  "status": "conectado",
  "qr_code": null,
  "ultimo_uso": "2025-11-11T10:30:00.000Z",
  "contexto_arquivo": "...",
  "cliente_nome": "Empresa XYZ",
  "cliente_ativo": true
}
```

---

#### `GET /sessoes/:id/qr`
Obter QR Code para autenticação

**Response (se disponível):**
```json
{
  "qr": "data:image/png;base64,iVBORw0KGgo...",
  "status": "aguardando_qr"
}
```

**Response (se já conectado):**
```json
{
  "message": "Sessão já conectada",
  "connected": true
}
```

**Response (se indisponível): 404**
```json
{
  "error": "QR Code não disponível"
}
```

**Fluxo de uso:**
1. Criar sessão com `POST /sessoes`
2. Aguardar 2-5 segundos
3. Consultar `GET /sessoes/:id/qr` até QR aparecer
4. Exibir QR Code no frontend
5. Usuário escaneia com WhatsApp
6. Status muda para `conectado`

---

#### `DELETE /sessoes/:id`
Deletar sessão e desconectar bot

**Response:**
```json
{
  "message": "Sessão deletada com sucesso"
}
```

---

### 🔹 Logs

#### `GET /sessoes/:id/logs`
Buscar histórico de mensagens de uma sessão

**Query Params:**
- `limit` (opcional): número de mensagens (default: 100)

**Response:**
```json
[
  {
    "id": 1,
    "sessao_id": 1,
    "sender": "5511987654321@s.whatsapp.net",
    "mensagem": "Olá, quanto custa o Produto A?",
    "tipo": "recebida",
    "resposta_tempo_ms": null,
    "created_at": "2025-11-11T10:00:00.000Z"
  },
  {
    "id": 2,
    "sessao_id": 1,
    "sender": "5511987654321@s.whatsapp.net",
    "mensagem": "O Produto A custa R$ 100,00.",
    "tipo": "enviada",
    "resposta_tempo_ms": 1234,
    "created_at": "2025-11-11T10:00:02.000Z"
  }
]
```

---

## 🔄 Fluxo de Uso

### 1. Criar Cliente
```javascript
const cliente = await fetch('/clientes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nome: 'Minha Empresa',
    email: 'contato@empresa.com',
    telefone: '+5511999999999',
    contextoArquivo: 'Você é assistente da Minha Empresa...'
  })
}).then(r => r.json());

console.log('Cliente criado:', cliente.id);
```

### 2. Criar Sessão WhatsApp
```javascript
const sessao = await fetch('/sessoes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clienteId: cliente.id,
    whatsappNumero: '5511999999999'
  })
}).then(r => r.json());

console.log('Sessão criada:', sessao.id);
```

### 3. Obter QR Code
```javascript
// Aguardar 3 segundos
await new Promise(r => setTimeout(r, 3000));

const qr = await fetch(`/sessoes/${sessao.id}/qr`)
  .then(r => r.json());

if (qr.qr) {
  // Exibir QR Code no frontend
  document.getElementById('qr-image').src = qr.qr;
}
```

### 4. Verificar Status
```javascript
// Polling a cada 5 segundos
setInterval(async () => {
  const status = await fetch(`/sessoes/${sessao.id}`)
    .then(r => r.json());

  if (status.status === 'conectado') {
    console.log('WhatsApp conectado!');
    // Esconder QR Code
  }
}, 5000);
```

### 5. Ver Logs
```javascript
const logs = await fetch(`/sessoes/${sessao.id}/logs?limit=50`)
  .then(r => r.json());

console.log('Últimas 50 mensagens:', logs);
```

---

## 🐛 Troubleshooting

### Erro: "Falha ao conectar ao banco de dados"
- Verifique se `DATABASE_URL` está correta no `.env`
- Teste a conexão: `psql $DATABASE_URL`
- Certifique-se que as tabelas foram criadas (execute `schema.sql`)

### QR Code não aparece
- Aguarde até 5 segundos após criar a sessão
- Verifique logs do servidor
- Tente deletar e recriar a sessão

### Sessão desconecta sozinha
- WhatsApp pode desconectar por inatividade
- O sistema tenta reconectar automaticamente
- Se status = `loggedOut`, precisa gerar novo QR

### TODO: Expurgo de Logs
Os logs de mensagens crescem indefinidamente. Futuramente será implementado um mecanismo automático de expurgo para mensagens antigas (ver `database/queries.js:254` - função `expurgarLogsAntigos`).

**Solução temporária manual:**
```sql
DELETE FROM mensagens_log WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## 📄 Licença

MIT

---

## 🤝 Suporte

Para dúvidas ou problemas:
- Verifique os logs do servidor
- Consulte a documentação do Baileys
- Verifique a API do Groq

---

**Desenvolvido com Baileys + Groq + PostgreSQL**
