# 📱 Guia Completo para Integração Frontend

**Sistema:** Bot WhatsApp Multi-Sessão com IA
**Backend:** Node.js + Express + Baileys + PostgreSQL
**Documento:** Especificação completa para desenvolvimento frontend

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Base URL e Autenticação](#base-url-e-autenticação)
3. [Rotas da API](#rotas-da-api)
4. [Fluxos de Integração](#fluxos-de-integração)
5. [Exemplos de Código](#exemplos-de-código)
6. [Tratamento de Erros](#tratamento-de-erros)
7. [Estados e Status](#estados-e-status)
8. [WebSockets (Futuro)](#websockets-futuro)
9. [Tipos TypeScript](#tipos-typescript)
10. [Boas Práticas](#boas-práticas)

---

## 🎯 Visão Geral

### Arquitetura

```
Frontend (React/Vue/Angular)
      ↓
   REST API (Express)
      ↓
   PostgreSQL + Baileys (WhatsApp)
```

### Conceitos Principais

- **Cliente**: Empresa/pessoa que usa o sistema (ex: "Pizzaria XYZ")
- **Sessão**: Conexão WhatsApp de um número específico
- **Contexto**: Instruções para a IA sobre como responder (preços, horários, etc.)
- **QR Code**: String gerada para autenticação WhatsApp

### Fluxo Geral

1. **Criar Cliente** → Define contexto da IA
2. **Criar Sessão** → Backend inicia bot WhatsApp
3. **Obter QR Code** → Usuário escaneia com WhatsApp
4. **Monitorar Status** → Verificar se conectou
5. **Bot Funcionando** → Responde mensagens automaticamente

---

## 🔗 Base URL e Autenticação

### Base URL

```
Desenvolvimento: http://localhost:3000
Produção: https://seu-app.up.railway.app
```

### Autenticação

⚠️ **Atualmente não há autenticação implementada.**

**Recomendação para produção:**
- Implementar JWT ou API Key
- Todas as rotas devem exigir header `Authorization: Bearer <token>`
- Implementar roles (admin, cliente, etc.)

**Header recomendado (futuro):**
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer seu_token_jwt_aqui'
}
```

---

## 📡 Rotas da API

### 🔹 Sistema

#### `GET /health`

**Descrição:** Health check do sistema
**Quando usar:** Verificar se API está online, monitoramento
**Autenticação:** Não requer

**Response:**
```typescript
{
  status: "ok",
  uptime: 12345.67,
  provider: "Groq (Free)",
  model: "llama-3.1-8b-instant",
  library: "Baileys",
  activeSessions: 3,
  timestamp: "2025-11-11T10:00:00.000Z"
}
```

**Exemplo:**
```javascript
const checkHealth = async () => {
  const response = await fetch('https://api.exemplo.com/health');
  const data = await response.json();
  console.log('API Status:', data.status);
};
```

---

#### `GET /status`

**Descrição:** Status de todas as sessões ativas
**Quando usar:** Dashboard principal, overview do sistema
**Autenticação:** Não requer (mas deveria em produção)

**Response:**
```typescript
{
  activeSessions: 2,
  sessions: [
    {
      sessionName: "session_5511999999999_1234567890",
      whatsappNumero: "5511999999999",
      connected: true,
      clienteNome: "Empresa Demo"
    }
  ],
  timestamp: "2025-11-11T10:00:00.000Z"
}
```

**Exemplo:**
```javascript
const getStatus = async () => {
  const response = await fetch('https://api.exemplo.com/status');
  const data = await response.json();

  console.log(`Sessões ativas: ${data.activeSessions}`);
  data.sessions.forEach(s => {
    console.log(`${s.clienteNome}: ${s.connected ? 'Conectado' : 'Desconectado'}`);
  });
};
```

---

### 🔹 Clientes

#### `POST /clientes`

**Descrição:** Criar novo cliente
**Quando usar:** Onboarding, cadastro de nova empresa
**Autenticação:** Deveria exigir (admin only)

**Body:**
```typescript
{
  nome: string;           // Obrigatório
  email?: string;         // Opcional (mas recomendado)
  telefone?: string;      // Opcional
  contextoArquivo: string; // Obrigatório - Instruções para a IA
}
```

**Response 201:**
```typescript
{
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  contexto_arquivo: string;
  created_at: string;
  updated_at: string;
}
```

**Response 400:**
```typescript
{
  error: "Nome e contextoArquivo são obrigatórios"
}
```

**Exemplo:**
```javascript
const criarCliente = async (dados) => {
  const response = await fetch('https://api.exemplo.com/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      contextoArquivo: dados.contexto
    })
  });

  if (!response.ok) {
    throw new Error('Erro ao criar cliente');
  }

  const cliente = await response.json();
  return cliente.id;
};

// Uso:
const clienteId = await criarCliente({
  nome: 'Pizzaria Don João',
  email: 'contato@donjoao.com',
  telefone: '+5511987654321',
  contexto: `Você é assistente virtual da Pizzaria Don João.

Cardápio:
- Pizza Margherita: R$ 35,00
- Pizza Calabresa: R$ 38,00
- Pizza 4 Queijos: R$ 42,00

Horário de funcionamento:
Terça a Domingo: 18h às 23h
Segunda: Fechado

Delivery: Taxa de R$ 5,00
Tempo médio: 40 minutos

Responda sempre de forma educada e objetiva.`
});
```

---

#### `GET /clientes`

**Descrição:** Listar todos os clientes
**Quando usar:** Lista/tabela de clientes, dashboard
**Autenticação:** Deveria exigir

**Query Params:**
```typescript
ativos?: "true" | "false"  // Default: "true"
```

**Response:**
```typescript
Array<{
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}>
```

**Exemplo:**
```javascript
const listarClientes = async (apenasAtivos = true) => {
  const url = new URL('https://api.exemplo.com/clientes');
  if (!apenasAtivos) {
    url.searchParams.append('ativos', 'false');
  }

  const response = await fetch(url);
  const clientes = await response.json();

  return clientes;
};

// Uso:
const clientes = await listarClientes(true);
clientes.forEach(c => {
  console.log(`${c.id}: ${c.nome} (${c.ativo ? 'Ativo' : 'Inativo'})`);
});
```

---

#### `GET /clientes/:id`

**Descrição:** Buscar cliente por ID
**Quando usar:** Detalhes do cliente, edição
**Autenticação:** Deveria exigir

**Response 200:**
```typescript
{
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  contexto_arquivo: string;
  created_at: string;
  updated_at: string;
}
```

**Response 404:**
```typescript
{
  error: "Cliente não encontrado"
}
```

**Exemplo:**
```javascript
const buscarCliente = async (id) => {
  const response = await fetch(`https://api.exemplo.com/clientes/${id}`);

  if (response.status === 404) {
    throw new Error('Cliente não encontrado');
  }

  return await response.json();
};
```

---

#### `PUT /clientes/:id`

**Descrição:** Atualizar dados do cliente
**Quando usar:** Edição de cadastro (nome, email, telefone, status)
**Autenticação:** Deveria exigir

**Body (todos opcionais):**
```typescript
{
  nome?: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
}
```

**Response 200:**
```typescript
{
  id: number;
  nome: string;
  email: string | null;
  updated_at: string;
  // ... outros campos
}
```

**Response 404:**
```typescript
{
  error: "Cliente não encontrado"
}
```

**Exemplo:**
```javascript
const atualizarCliente = async (id, dados) => {
  const response = await fetch(`https://api.exemplo.com/clientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });

  if (!response.ok) {
    throw new Error('Erro ao atualizar cliente');
  }

  return await response.json();
};

// Uso:
await atualizarCliente(1, {
  telefone: '+5511999998888',
  email: 'novo@email.com'
});
```

---

#### `PUT /clientes/:id/contexto`

**Descrição:** Atualizar APENAS o contexto (System Prompt) da IA
**Quando usar:** Alterar cardápio, preços, horários, sem mudar dados cadastrais
**Autenticação:** Deveria exigir
**⚠️ IMPORTANTE:** Atualiza automaticamente em todas as sessões ativas!

**Body:**
```typescript
{
  contextoArquivo: string;  // Obrigatório
}
```

**Response 200:**
```typescript
{
  id: number;
  contexto_arquivo: string;
  updated_at: string;
}
```

**Response 400:**
```typescript
{
  error: "contextoArquivo é obrigatório"
}
```

**Exemplo:**
```javascript
const atualizarContexto = async (clienteId, novoContexto) => {
  const response = await fetch(`https://api.exemplo.com/clientes/${clienteId}/contexto`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextoArquivo: novoContexto
    })
  });

  if (!response.ok) {
    throw new Error('Erro ao atualizar contexto');
  }

  return await response.json();
};

// Uso:
await atualizarContexto(1, `
Você é assistente da Pizzaria Don João.

NOVO CARDÁPIO (atualizado):
- Pizza Margherita: R$ 38,00 (era R$ 35,00)
- Pizza Calabresa: R$ 42,00 (era R$ 38,00)
- Pizza Portuguesa: R$ 45,00 (NOVO!)

Promoção de terça: 2 pizzas por R$ 70,00
`);
```

---

#### `DELETE /clientes/:id`

**Descrição:** Desativar cliente (soft delete)
**Quando usar:** Cancelamento, suspensão de conta
**Autenticação:** Deveria exigir (admin only)
**⚠️ IMPORTANTE:** Desconecta TODAS as sessões ativas do cliente!

**Response 200:**
```typescript
{
  message: "Cliente desativado com sucesso",
  cliente: {
    id: number;
    ativo: false;
  }
}
```

**Response 404:**
```typescript
{
  error: "Cliente não encontrado"
}
```

**Exemplo:**
```javascript
const desativarCliente = async (id) => {
  if (!confirm('Tem certeza? Isso desconectará todas as sessões WhatsApp deste cliente.')) {
    return;
  }

  const response = await fetch(`https://api.exemplo.com/clientes/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error('Erro ao desativar cliente');
  }

  const result = await response.json();
  console.log(result.message);
};
```

---

#### `GET /clientes/:id/sessoes`

**Descrição:** Listar todas as sessões WhatsApp de um cliente
**Quando usar:** Gerenciar múltiplos números de um mesmo cliente
**Autenticação:** Deveria exigir

**Response:**
```typescript
Array<{
  id: number;
  cliente_id: number;
  whatsapp_numero: string;
  session_name: string;
  status: "conectado" | "desconectado" | "aguardando_qr";
  qr_code: string | null;
  ultimo_uso: string | null;
  created_at: string;
  updated_at: string;
}>
```

**Exemplo:**
```javascript
const listarSessoesCliente = async (clienteId) => {
  const response = await fetch(`https://api.exemplo.com/clientes/${clienteId}/sessoes`);
  const sessoes = await response.json();

  return sessoes;
};

// Uso:
const sessoes = await listarSessoesCliente(1);
console.log(`Cliente tem ${sessoes.length} sessões`);
sessoes.forEach(s => {
  console.log(`${s.whatsapp_numero}: ${s.status}`);
});
```

---

### 🔹 Sessões WhatsApp

#### `POST /sessoes`

**Descrição:** Criar nova sessão WhatsApp e iniciar bot
**Quando usar:** Conectar novo número de WhatsApp
**Autenticação:** Deveria exigir
**⚠️ IMPORTANTE:** O bot é iniciado AUTOMATICAMENTE no backend!

**Body:**
```typescript
{
  clienteId: number;      // Obrigatório
  whatsappNumero: string; // Obrigatório - Formato: "5511999999999" (sem espaços/caracteres)
}
```

**Response 201:**
```typescript
{
  id: number;
  cliente_id: number;
  whatsapp_numero: string;
  session_name: string;
  status: "desconectado";
  qr_code: null;
  ultimo_uso: null;
  created_at: string;
  updated_at: string;
}
```

**Response 400:**
```typescript
{
  error: "clienteId e whatsappNumero são obrigatórios"
}
// ou
{
  error: "Cliente não encontrado"
}
// ou
{
  error: "Cliente inativo"
}
```

**⚠️ Regras Importantes:**
- `whatsappNumero` deve ser ÚNICO (não pode duplicar)
- Aguardar 2-3 segundos antes de buscar QR Code
- Backend inicia o bot automaticamente

**Exemplo:**
```javascript
const criarSessao = async (clienteId, whatsappNumero) => {
  // Remover caracteres especiais do número
  const numeroLimpo = whatsappNumero.replace(/\D/g, '');

  const response = await fetch('https://api.exemplo.com/sessoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId,
      whatsappNumero: numeroLimpo
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const sessao = await response.json();

  // IMPORTANTE: Aguardar 2-3 segundos antes de buscar QR Code
  await new Promise(resolve => setTimeout(resolve, 3000));

  return sessao.id;
};

// Uso:
const sessaoId = await criarSessao(1, '+55 11 99999-9999');
console.log('Sessão criada, aguarde o QR Code...');
```

---

#### `GET /sessoes`

**Descrição:** Listar todas as sessões
**Quando usar:** Dashboard, lista de todas as sessões do sistema
**Autenticação:** Deveria exigir

**Query Params:**
```typescript
status?: "conectado" | "desconectado" | "aguardando_qr"
```

**Response:**
```typescript
Array<{
  id: number;
  cliente_id: number;
  whatsapp_numero: string;
  session_name: string;
  status: "conectado" | "desconectado" | "aguardando_qr";
  qr_code: string | null;
  ultimo_uso: string | null;
  contexto_arquivo: string;
  cliente_nome: string;
  cliente_ativo: boolean;
  created_at: string;
  updated_at: string;
}>
```

**Exemplo:**
```javascript
const listarSessoes = async (filtroStatus = null) => {
  const url = new URL('https://api.exemplo.com/sessoes');

  if (filtroStatus) {
    url.searchParams.append('status', filtroStatus);
  }

  const response = await fetch(url);
  const sessoes = await response.json();

  return sessoes;
};

// Uso:
const conectadas = await listarSessoes('conectado');
const todas = await listarSessoes();
```

---

#### `GET /sessoes/:id`

**Descrição:** Buscar sessão específica por ID
**Quando usar:** Detalhes da sessão, verificar status atual
**Autenticação:** Deveria exigir

**Response 200:**
```typescript
{
  id: number;
  cliente_id: number;
  whatsapp_numero: string;
  session_name: string;
  status: "conectado" | "desconectado" | "aguardando_qr";
  qr_code: string | null;
  ultimo_uso: string | null;
  contexto_arquivo: string;
  cliente_nome: string;
  cliente_ativo: boolean;
  created_at: string;
  updated_at: string;
}
```

**Response 404:**
```typescript
{
  error: "Sessão não encontrada"
}
```

**Exemplo:**
```javascript
const buscarSessao = async (id) => {
  const response = await fetch(`https://api.exemplo.com/sessoes/${id}`);

  if (response.status === 404) {
    throw new Error('Sessão não encontrada');
  }

  return await response.json();
};

// Uso para polling de status:
const monitorarStatus = async (sessaoId, callback) => {
  const interval = setInterval(async () => {
    try {
      const sessao = await buscarSessao(sessaoId);
      callback(sessao.status);

      if (sessao.status === 'conectado') {
        clearInterval(interval);
      }
    } catch (error) {
      console.error('Erro ao monitorar:', error);
    }
  }, 5000); // A cada 5 segundos

  return interval;
};
```

---

#### `GET /sessoes/:id/qr`

**Descrição:** Obter QR Code para autenticação WhatsApp
**Quando usar:** Logo após criar sessão, durante processo de conexão
**Autenticação:** Deveria exigir
**⚠️ CRÍTICO:** Fazer polling a cada 3 segundos até obter o QR!

**Response 200 - QR Disponível:**
```typescript
{
  qr: string;  // String do QR Code (não é base64!)
  status: "aguardando_qr"
}
```

**Response 200 - Já Conectado:**
```typescript
{
  message: "Sessão já conectada",
  connected: true
}
```

**Response 404 - QR Não Disponível Ainda:**
```typescript
{
  error: "QR Code não disponível"
}
```

**Fluxo Correto:**

1. Criar sessão com `POST /sessoes`
2. Aguardar 2-3 segundos
3. Fazer polling de `GET /sessoes/:id/qr` a cada 3 segundos
4. Se retornar 404 → continuar polling
5. Se retornar QR → exibir para o usuário
6. Se retornar "connected" → parar polling

**Exemplo Completo:**
```javascript
const obterQRCode = async (sessaoId) => {
  return new Promise((resolve, reject) => {
    let tentativas = 0;
    const maxTentativas = 20; // 20 * 3s = 60 segundos timeout

    const interval = setInterval(async () => {
      tentativas++;

      if (tentativas > maxTentativas) {
        clearInterval(interval);
        reject(new Error('Timeout: QR Code não foi gerado em 60 segundos'));
        return;
      }

      try {
        const response = await fetch(`https://api.exemplo.com/sessoes/${sessaoId}/qr`);

        if (response.status === 404) {
          console.log(`Tentativa ${tentativas}: QR ainda não disponível...`);
          return; // Continua polling
        }

        const data = await response.json();

        if (data.qr) {
          clearInterval(interval);
          resolve({ tipo: 'qr', qr: data.qr });
        } else if (data.connected) {
          clearInterval(interval);
          resolve({ tipo: 'conectado' });
        }
      } catch (error) {
        console.error('Erro ao buscar QR:', error);
        // Não rejeita, continua tentando
      }
    }, 3000); // Polling a cada 3 segundos
  });
};

// Uso:
try {
  const resultado = await obterQRCode(sessaoId);

  if (resultado.tipo === 'qr') {
    exibirQRCode(resultado.qr);
  } else {
    console.log('Sessão já conectada!');
  }
} catch (error) {
  console.error('Erro:', error.message);
}
```

**⚠️ Importante sobre o QR Code:**
- O `qr` retornado é uma **STRING** (não é base64 de imagem)
- Use bibliotecas como `qrcode.react` ou `qrcode` para exibir
- O QR Code expira em ~60 segundos
- Se expirar, precisa deletar e recriar a sessão

---

#### `DELETE /sessoes/:id`

**Descrição:** Deletar sessão e desconectar bot WhatsApp
**Quando usar:** Remover número, trocar QR Code expirado
**Autenticação:** Deveria exigir
**⚠️ IMPORTANTE:** Desconecta o bot e remove do banco!

**Response 200:**
```typescript
{
  message: "Sessão deletada com sucesso"
}
```

**Response 404:**
```typescript
{
  error: "Sessão não encontrada"
}
```

**Exemplo:**
```javascript
const deletarSessao = async (id) => {
  if (!confirm('Desconectar este número do WhatsApp?')) {
    return;
  }

  const response = await fetch(`https://api.exemplo.com/sessoes/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error('Erro ao deletar sessão');
  }

  const result = await response.json();
  console.log(result.message);
};

// Uso: Recriar sessão com QR expirado
const recriarSessaoComQRExpirado = async (sessaoAntigaId, clienteId, whatsappNumero) => {
  // 1. Deletar sessão antiga
  await deletarSessao(sessaoAntigaId);

  // 2. Criar nova sessão
  const novaSessaoId = await criarSessao(clienteId, whatsappNumero);

  // 3. Obter novo QR Code
  const resultado = await obterQRCode(novaSessaoId);

  return resultado;
};
```

---

### 🔹 Logs de Mensagens

#### `GET /sessoes/:id/logs`

**Descrição:** Buscar histórico de mensagens de uma sessão
**Quando usar:** Ver conversas, auditoria, análise de mensagens
**Autenticação:** Deveria exigir

**Query Params:**
```typescript
limit?: number  // Default: 100
```

**Response:**
```typescript
Array<{
  id: number;
  sessao_id: number;
  sender: string;           // Ex: "5511987654321@s.whatsapp.net"
  mensagem: string;
  tipo: "recebida" | "enviada";
  resposta_tempo_ms: number | null;  // Tempo que a IA levou para responder
  created_at: string;
}>
```

**Exemplo:**
```javascript
const buscarLogs = async (sessaoId, limite = 50) => {
  const url = new URL(`https://api.exemplo.com/sessoes/${sessaoId}/logs`);
  url.searchParams.append('limit', limite.toString());

  const response = await fetch(url);
  const logs = await response.json();

  return logs;
};

// Uso:
const logs = await buscarLogs(1, 100);

logs.forEach(log => {
  const tipo = log.tipo === 'recebida' ? '👤' : '🤖';
  const tempo = log.resposta_tempo_ms ? ` (${log.resposta_tempo_ms}ms)` : '';

  console.log(`${tipo} ${log.sender}: ${log.mensagem}${tempo}`);
});

// Análise:
const mensagensRecebidas = logs.filter(l => l.tipo === 'recebida').length;
const mensagensEnviadas = logs.filter(l => l.tipo === 'enviada').length;
const tempoMedio = logs
  .filter(l => l.resposta_tempo_ms)
  .reduce((acc, l) => acc + l.resposta_tempo_ms, 0) / mensagensEnviadas;

console.log(`Recebidas: ${mensagensRecebidas}`);
console.log(`Enviadas: ${mensagensEnviadas}`);
console.log(`Tempo médio de resposta: ${tempoMedio.toFixed(0)}ms`);
```

---

## 🔄 Fluxos de Integração

### Fluxo 1: Onboarding Completo (Cliente Novo)

```javascript
async function onboardingCompleto(dados) {
  try {
    // 1. Criar cliente
    console.log('1. Criando cliente...');
    const cliente = await fetch('/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: dados.nomeEmpresa,
        email: dados.email,
        telefone: dados.telefone,
        contextoArquivo: dados.contextoIA
      })
    }).then(r => r.json());

    console.log(`✓ Cliente criado: ID ${cliente.id}`);

    // 2. Criar sessão WhatsApp
    console.log('2. Criando sessão WhatsApp...');
    const sessao = await fetch('/sessoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId: cliente.id,
        whatsappNumero: dados.whatsappNumero.replace(/\D/g, '')
      })
    }).then(r => r.json());

    console.log(`✓ Sessão criada: ID ${sessao.id}`);

    // 3. Aguardar 3 segundos
    console.log('3. Aguardando bot iniciar...');
    await new Promise(r => setTimeout(r, 3000));

    // 4. Buscar QR Code com polling
    console.log('4. Buscando QR Code...');
    const qrResult = await obterQRCodeComPolling(sessao.id);

    if (qrResult.tipo === 'qr') {
      console.log('✓ QR Code obtido!');
      return {
        sucesso: true,
        clienteId: cliente.id,
        sessaoId: sessao.id,
        qrCode: qrResult.qr
      };
    } else {
      console.log('✓ Sessão já estava conectada!');
      return {
        sucesso: true,
        clienteId: cliente.id,
        sessaoId: sessao.id,
        jaConectado: true
      };
    }

  } catch (error) {
    console.error('❌ Erro no onboarding:', error);
    throw error;
  }
}

// Uso:
const resultado = await onboardingCompleto({
  nomeEmpresa: 'Pizzaria Don João',
  email: 'contato@donjoao.com',
  telefone: '+5511987654321',
  whatsappNumero: '+55 11 99999-8888',
  contextoIA: 'Você é assistente da Pizzaria Don João...'
});

if (resultado.sucesso) {
  exibirQRCode(resultado.qrCode);
}
```

---

### Fluxo 2: Adicionar Nova Sessão (Cliente Existente)

```javascript
async function adicionarNovoNumero(clienteId, whatsappNumero) {
  try {
    // 1. Verificar se cliente existe e está ativo
    const cliente = await fetch(`/clientes/${clienteId}`).then(r => r.json());

    if (!cliente.ativo) {
      throw new Error('Cliente inativo');
    }

    // 2. Criar sessão
    const sessao = await fetch('/sessoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId,
        whatsappNumero: whatsappNumero.replace(/\D/g, '')
      })
    }).then(r => r.json());

    // 3. Aguardar e obter QR Code
    await new Promise(r => setTimeout(r, 3000));
    const qrResult = await obterQRCodeComPolling(sessao.id);

    return {
      sucesso: true,
      sessaoId: sessao.id,
      qrCode: qrResult.qr
    };

  } catch (error) {
    console.error('Erro ao adicionar número:', error);
    throw error;
  }
}
```

---

### Fluxo 3: Atualizar Contexto em Tempo Real

```javascript
async function atualizarCardapio(clienteId, novoCardapio) {
  try {
    // 1. Buscar contexto atual
    const cliente = await fetch(`/clientes/${clienteId}`).then(r => r.json());

    // 2. Montar novo contexto
    const novoContexto = `${cliente.contexto_arquivo}

CARDÁPIO ATUALIZADO:
${novoCardapio}

Atualizado em: ${new Date().toLocaleString('pt-BR')}`;

    // 3. Atualizar contexto
    await fetch(`/clientes/${clienteId}/contexto`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextoArquivo: novoContexto
      })
    });

    console.log('✓ Contexto atualizado em todas as sessões ativas!');

    return { sucesso: true };

  } catch (error) {
    console.error('Erro ao atualizar contexto:', error);
    throw error;
  }
}

// Uso:
await atualizarCardapio(1, `
- Pizza Margherita: R$ 38,00
- Pizza Calabresa: R$ 42,00
- Pizza Portuguesa: R$ 45,00 (NOVO!)
`);
```

---

### Fluxo 4: Monitoramento Completo de Sessão

```javascript
class MonitorSessao {
  constructor(sessaoId) {
    this.sessaoId = sessaoId;
    this.intervaloQR = null;
    this.intervaloStatus = null;
  }

  async iniciar(callbacks) {
    const { onQRCode, onConectado, onDesconectado, onErro } = callbacks;

    try {
      // 1. Buscar estado inicial
      const sessao = await fetch(`/sessoes/${this.sessaoId}`).then(r => r.json());

      if (sessao.status === 'conectado') {
        onConectado();
        return;
      }

      // 2. Polling do QR Code
      this.intervaloQR = setInterval(async () => {
        try {
          const response = await fetch(`/sessoes/${this.sessaoId}/qr`);

          if (response.ok) {
            const data = await response.json();

            if (data.qr) {
              onQRCode(data.qr);
            } else if (data.connected) {
              this.parar();
              onConectado();
            }
          }
        } catch (error) {
          console.error('Erro polling QR:', error);
        }
      }, 3000);

      // 3. Polling do Status
      this.intervaloStatus = setInterval(async () => {
        try {
          const sessao = await fetch(`/sessoes/${this.sessaoId}`).then(r => r.json());

          if (sessao.status === 'conectado') {
            this.parar();
            onConectado();
          } else if (sessao.status === 'desconectado') {
            // Não para o polling, pode estar reconectando
          }
        } catch (error) {
          console.error('Erro polling status:', error);
        }
      }, 5000);

    } catch (error) {
      onErro(error);
    }
  }

  parar() {
    if (this.intervaloQR) {
      clearInterval(this.intervaloQR);
      this.intervaloQR = null;
    }
    if (this.intervaloStatus) {
      clearInterval(this.intervaloStatus);
      this.intervaloStatus = null;
    }
  }
}

// Uso:
const monitor = new MonitorSessao(sessaoId);

monitor.iniciar({
  onQRCode: (qr) => {
    console.log('QR Code recebido');
    exibirQRCode(qr);
  },
  onConectado: () => {
    console.log('WhatsApp conectado!');
    esconderQRCode();
    mostrarMensagemSucesso();
  },
  onDesconectado: () => {
    console.log('WhatsApp desconectado');
  },
  onErro: (erro) => {
    console.error('Erro:', erro);
    mostrarErro(erro.message);
  }
});

// Parar monitoramento quando componente desmontar
// monitor.parar();
```

---

### Fluxo 5: Dashboard com Métricas

```javascript
async function carregarDashboard() {
  try {
    // 1. Status geral do sistema
    const status = await fetch('/status').then(r => r.json());

    // 2. Listar todos os clientes
    const clientes = await fetch('/clientes').then(r => r.json());

    // 3. Listar todas as sessões
    const sessoes = await fetch('/sessoes').then(r => r.json());

    // 4. Calcular métricas
    const metricas = {
      totalClientes: clientes.length,
      clientesAtivos: clientes.filter(c => c.ativo).length,
      totalSessoes: sessoes.length,
      sessoesConectadas: sessoes.filter(s => s.status === 'conectado').length,
      sessoesAguardando: sessoes.filter(s => s.status === 'aguardando_qr').length,
      sessoesDesconectadas: sessoes.filter(s => s.status === 'desconectado').length
    };

    // 5. Logs recentes (últimas 10 mensagens de cada sessão)
    const logsPromises = sessoes.slice(0, 5).map(s =>
      fetch(`/sessoes/${s.id}/logs?limit=10`).then(r => r.json())
    );
    const logs = await Promise.all(logsPromises);

    return {
      status,
      clientes,
      sessoes,
      metricas,
      logsRecentes: logs.flat()
    };

  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    throw error;
  }
}

// Uso:
const dashboard = await carregarDashboard();

console.log('=== DASHBOARD ===');
console.log(`Clientes: ${dashboard.metricas.totalClientes} (${dashboard.metricas.clientesAtivos} ativos)`);
console.log(`Sessões: ${dashboard.metricas.totalSessoes}`);
console.log(`  Conectadas: ${dashboard.metricas.sessoesConectadas}`);
console.log(`  Aguardando QR: ${dashboard.metricas.sessoesAguardando}`);
console.log(`  Desconectadas: ${dashboard.metricas.sessoesDesconectadas}`);
```

---

## ⚠️ Tratamento de Erros

### Tipos de Erros Comuns

```typescript
// Erros da API
type APIError = {
  error: string;
};

// Códigos HTTP
// 200: Sucesso
// 201: Criado
// 400: Bad Request (dados inválidos)
// 404: Not Found
// 500: Internal Server Error
```

### Wrapper de Fetch com Tratamento de Erros

```javascript
class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);

      // Tratar erros HTTP
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));

        switch (response.status) {
          case 400:
            throw new BadRequestError(error.error);
          case 404:
            throw new NotFoundError(error.error);
          case 500:
            throw new ServerError(error.error);
          default:
            throw new APIError(error.error || `HTTP ${response.status}`);
        }
      }

      // Sucesso
      if (response.status === 204) {
        return null; // No content
      }

      return await response.json();

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      // Erros de rede
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new NetworkError('Erro de conexão com o servidor');
      }

      throw new UnknownError(error.message);
    }
  }

  // Métodos auxiliares
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// Classes de erro customizadas
class APIError extends Error {
  constructor(message) {
    super(message);
    this.name = 'APIError';
  }
}

class BadRequestError extends APIError {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

class NotFoundError extends APIError {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ServerError extends APIError {
  constructor(message) {
    super(message);
    this.name = 'ServerError';
  }
}

class NetworkError extends APIError {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

class UnknownError extends APIError {
  constructor(message) {
    super(message);
    this.name = 'UnknownError';
  }
}

// Uso:
const api = new APIClient('https://api.exemplo.com');

try {
  const cliente = await api.post('/clientes', {
    nome: 'Teste',
    contextoArquivo: 'Contexto...'
  });
  console.log('Cliente criado:', cliente.id);

} catch (error) {
  if (error instanceof BadRequestError) {
    alert(`Dados inválidos: ${error.message}`);
  } else if (error instanceof NotFoundError) {
    alert('Recurso não encontrado');
  } else if (error instanceof NetworkError) {
    alert('Sem conexão com o servidor');
  } else {
    alert(`Erro: ${error.message}`);
  }
}
```

---

### Retry com Backoff Exponencial

```javascript
async function fetchComRetry(url, options = {}, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return await response.json();
      }

      // Não fazer retry em erros 4xx (erro do cliente)
      if (response.status >= 400 && response.status < 500) {
        const error = await response.json();
        throw new Error(error.error);
      }

      // Retry em erros 5xx (erro do servidor)
      lastError = new Error(`HTTP ${response.status}`);

    } catch (error) {
      lastError = error;

      if (i < maxRetries - 1) {
        // Backoff exponencial: 1s, 2s, 4s
        const delay = Math.pow(2, i) * 1000;
        console.log(`Retry ${i + 1}/${maxRetries} em ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Uso:
try {
  const cliente = await fetchComRetry('https://api.exemplo.com/clientes/1', {}, 3);
} catch (error) {
  console.error('Falhou após 3 tentativas:', error);
}
```

---

## 📊 Estados e Status

### Status de Sessão

```typescript
type StatusSessao =
  | "desconectado"    // Sessão criada mas não conectada
  | "aguardando_qr"   // QR Code gerado, aguardando scan
  | "conectado";      // WhatsApp conectado e funcionando

// Fluxo normal:
// desconectado → aguardando_qr → conectado

// Possíveis transições:
// - desconectado → aguardando_qr (QR gerado)
// - aguardando_qr → conectado (usuário escaneou)
// - aguardando_qr → desconectado (QR expirou)
// - conectado → desconectado (sessão caiu)
// - desconectado → aguardando_qr (reconexão automática)
```

### Máquina de Estados

```javascript
class SessaoStateMachine {
  constructor(sessaoId) {
    this.sessaoId = sessaoId;
    this.estado = 'desconectado';
    this.listeners = [];
  }

  async verificarEstado() {
    const sessao = await fetch(`/sessoes/${this.sessaoId}`).then(r => r.json());
    this.setState(sessao.status);
  }

  setState(novoEstado) {
    const estadoAnterior = this.estado;
    this.estado = novoEstado;

    console.log(`Transição: ${estadoAnterior} → ${novoEstado}`);

    // Notificar listeners
    this.listeners.forEach(listener => {
      listener(novoEstado, estadoAnterior);
    });

    // Ações baseadas no estado
    this.handleStateChange(novoEstado);
  }

  handleStateChange(estado) {
    switch (estado) {
      case 'desconectado':
        console.log('Sessão desconectada');
        break;

      case 'aguardando_qr':
        console.log('QR Code gerado, aguardando scan');
        break;

      case 'conectado':
        console.log('WhatsApp conectado!');
        break;
    }
  }

  on(listener) {
    this.listeners.push(listener);
  }

  iniciarMonitoramento() {
    this.intervalo = setInterval(() => {
      this.verificarEstado();
    }, 5000);
  }

  pararMonitoramento() {
    if (this.intervalo) {
      clearInterval(this.intervalo);
    }
  }
}

// Uso:
const sm = new SessaoStateMachine(1);

sm.on((novoEstado, estadoAnterior) => {
  if (novoEstado === 'conectado') {
    alert('WhatsApp conectado com sucesso!');
    sm.pararMonitoramento();
  }
});

sm.iniciarMonitoramento();
```

---

## 🔮 WebSockets (Futuro)

**Status atual:** Não implementado
**Recomendação:** Implementar para notificações em tempo real

### Casos de Uso para WebSockets

1. **Notificação de QR Code gerado**
   - Evita polling
   - Notifica instantaneamente quando QR está disponível

2. **Notificação de conexão estabelecida**
   - Evita polling de status
   - Notifica quando WhatsApp conectou

3. **Notificação de nova mensagem recebida**
   - Dashboard em tempo real
   - Notificações push

4. **Notificação de desconexão**
   - Alertar quando sessão cai

### Exemplo de Implementação (Futuro)

```javascript
// ESTE CÓDIGO É EXEMPLO PARA IMPLEMENTAÇÃO FUTURA

class WhatsAppWebSocket {
  constructor(baseURL, sessaoId) {
    this.wsURL = baseURL.replace('http', 'ws') + `/ws/sessoes/${sessaoId}`;
    this.ws = null;
    this.listeners = {};
  }

  connect() {
    this.ws = new WebSocket(this.wsURL);

    this.ws.onopen = () => {
      console.log('WebSocket conectado');
      this.emit('conectado');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket erro:', error);
      this.emit('erro', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket fechado');
      this.emit('desconectado');
      // Reconectar após 5 segundos
      setTimeout(() => this.connect(), 5000);
    };
  }

  handleMessage(data) {
    switch (data.tipo) {
      case 'qr_gerado':
        this.emit('qr_gerado', data.qr);
        break;

      case 'whatsapp_conectado':
        this.emit('whatsapp_conectado');
        break;

      case 'mensagem_recebida':
        this.emit('mensagem_recebida', data.mensagem);
        break;

      case 'sessao_desconectada':
        this.emit('sessao_desconectada');
        break;
    }
  }

  on(evento, callback) {
    if (!this.listeners[evento]) {
      this.listeners[evento] = [];
    }
    this.listeners[evento].push(callback);
  }

  emit(evento, data) {
    if (this.listeners[evento]) {
      this.listeners[evento].forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Uso futuro:
const ws = new WhatsAppWebSocket('https://api.exemplo.com', sessaoId);

ws.on('qr_gerado', (qr) => {
  console.log('QR Code recebido via WebSocket!');
  exibirQRCode(qr);
});

ws.on('whatsapp_conectado', () => {
  console.log('WhatsApp conectado via WebSocket!');
  esconderQRCode();
});

ws.on('mensagem_recebida', (mensagem) => {
  console.log('Nova mensagem:', mensagem);
  atualizarListaMensagens(mensagem);
});

ws.connect();
```

**Benefícios de implementar WebSockets:**
- ✅ Elimina polling desnecessário
- ✅ Notificações instantâneas
- ✅ Reduz carga no servidor
- ✅ Melhor UX (mais responsivo)

**Quando implementar:**
- Quando tiver >10 sessões simultâneas
- Quando precisar de dashboard em tempo real
- Quando o polling começar a gerar tráfego excessivo

---

## 📝 Tipos TypeScript

```typescript
// ========================================
// TIPOS DA API
// ========================================

// Sistema
interface HealthResponse {
  status: "ok" | "error";
  uptime: number;
  provider: string;
  model: string;
  library: string;
  activeSessions: number;
  timestamp: string;
}

interface StatusResponse {
  activeSessions: number;
  sessions: SessionStatus[];
  timestamp: string;
}

interface SessionStatus {
  sessionName: string;
  whatsappNumero: string;
  connected: boolean;
  clienteNome: string;
}

// Clientes
interface Cliente {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  contexto_arquivo: string;
  created_at: string;
  updated_at: string;
}

interface CriarClienteRequest {
  nome: string;
  email?: string;
  telefone?: string;
  contextoArquivo: string;
}

interface AtualizarClienteRequest {
  nome?: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
}

interface AtualizarContextoRequest {
  contextoArquivo: string;
}

// Sessões
type StatusSessao = "conectado" | "desconectado" | "aguardando_qr";

interface Sessao {
  id: number;
  cliente_id: number;
  whatsapp_numero: string;
  session_name: string;
  status: StatusSessao;
  qr_code: string | null;
  ultimo_uso: string | null;
  created_at: string;
  updated_at: string;
}

interface SessaoComCliente extends Sessao {
  contexto_arquivo: string;
  cliente_nome: string;
  cliente_ativo: boolean;
}

interface CriarSessaoRequest {
  clienteId: number;
  whatsappNumero: string;
}

interface QRCodeResponse {
  qr: string;
  status: StatusSessao;
}

interface QRCodeConectadoResponse {
  message: "Sessão já conectada";
  connected: true;
}

// Logs
type TipoMensagem = "recebida" | "enviada";

interface MensagemLog {
  id: number;
  sessao_id: number;
  sender: string;
  mensagem: string;
  tipo: TipoMensagem;
  resposta_tempo_ms: number | null;
  created_at: string;
}

// Erros
interface APIError {
  error: string;
}

// ========================================
// CLASSE API CLIENT (TypeScript)
// ========================================

class WhatsAppBotAPI {
  constructor(private baseURL: string) {}

  // Sistema
  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  async status(): Promise<StatusResponse> {
    return this.get<StatusResponse>('/status');
  }

  // Clientes
  async criarCliente(dados: CriarClienteRequest): Promise<Cliente> {
    return this.post<Cliente>('/clientes', dados);
  }

  async listarClientes(apenasAtivos = true): Promise<Cliente[]> {
    const params = apenasAtivos ? '' : '?ativos=false';
    return this.get<Cliente[]>(`/clientes${params}`);
  }

  async buscarCliente(id: number): Promise<Cliente> {
    return this.get<Cliente>(`/clientes/${id}`);
  }

  async atualizarCliente(id: number, dados: AtualizarClienteRequest): Promise<Cliente> {
    return this.put<Cliente>(`/clientes/${id}`, dados);
  }

  async atualizarContexto(id: number, contexto: string): Promise<Cliente> {
    return this.put<Cliente>(`/clientes/${id}/contexto`, {
      contextoArquivo: contexto
    });
  }

  async desativarCliente(id: number): Promise<{ message: string; cliente: Cliente }> {
    return this.delete(`/clientes/${id}`);
  }

  async listarSessoesCliente(id: number): Promise<Sessao[]> {
    return this.get<Sessao[]>(`/clientes/${id}/sessoes`);
  }

  // Sessões
  async criarSessao(dados: CriarSessaoRequest): Promise<Sessao> {
    return this.post<Sessao>('/sessoes', dados);
  }

  async listarSessoes(status?: StatusSessao): Promise<SessaoComCliente[]> {
    const params = status ? `?status=${status}` : '';
    return this.get<SessaoComCliente[]>(`/sessoes${params}`);
  }

  async buscarSessao(id: number): Promise<SessaoComCliente> {
    return this.get<SessaoComCliente>(`/sessoes/${id}`);
  }

  async obterQRCode(id: number): Promise<QRCodeResponse | QRCodeConectadoResponse> {
    return this.get<QRCodeResponse | QRCodeConectadoResponse>(`/sessoes/${id}/qr`);
  }

  async deletarSessao(id: number): Promise<{ message: string }> {
    return this.delete(`/sessoes/${id}`);
  }

  // Logs
  async buscarLogs(sessaoId: number, limit = 100): Promise<MensagemLog[]> {
    return this.get<MensagemLog[]>(`/sessoes/${sessaoId}/logs?limit=${limit}`);
  }

  // Métodos auxiliares
  private async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`);
    if (!response.ok) throw await this.handleError(response);
    return response.json();
  }

  private async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw await this.handleError(response);
    return response.json();
  }

  private async put<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw await this.handleError(response);
    return response.json();
  }

  private async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw await this.handleError(response);
    return response.json();
  }

  private async handleError(response: Response): Promise<Error> {
    const error: APIError = await response.json().catch(() => ({
      error: 'Erro desconhecido'
    }));
    return new Error(error.error);
  }
}

// Uso:
const api = new WhatsAppBotAPI('https://api.exemplo.com');

const cliente = await api.criarCliente({
  nome: 'Teste',
  email: 'teste@teste.com',
  contextoArquivo: 'Contexto...'
});

const sessoes = await api.listarSessoes('conectado');
```

---

## ✅ Boas Práticas

### 1. Polling

```javascript
// ✅ BOM: Polling com timeout e limite
async function pollingComTimeout(endpoint, condicao, timeout = 60000) {
  const inicio = Date.now();

  while (Date.now() - inicio < timeout) {
    const data = await fetch(endpoint).then(r => r.json());

    if (condicao(data)) {
      return data;
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  throw new Error('Timeout');
}

// ❌ RUIM: Polling infinito sem timeout
async function pollingRuim(endpoint) {
  while (true) {
    const data = await fetch(endpoint).then(r => r.json());
    await new Promise(r => setTimeout(r, 1000)); // Muito frequente!
  }
}
```

### 2. Tratamento de Erros

```javascript
// ✅ BOM: Tratamento específico de erros
try {
  const cliente = await api.criarCliente(dados);
} catch (error) {
  if (error.message.includes('obrigatórios')) {
    mostrarErro('Preencha todos os campos obrigatórios');
  } else if (error.message.includes('não encontrado')) {
    mostrarErro('Cliente não encontrado');
  } else {
    mostrarErro('Erro ao criar cliente');
    console.error(error);
  }
}

// ❌ RUIM: Catch genérico
try {
  const cliente = await api.criarCliente(dados);
} catch (error) {
  console.log('Erro'); // Não informa o usuário!
}
```

### 3. Validação de Dados

```javascript
// ✅ BOM: Validar antes de enviar
function validarDadosCliente(dados) {
  const erros = [];

  if (!dados.nome || dados.nome.trim().length < 3) {
    erros.push('Nome deve ter pelo menos 3 caracteres');
  }

  if (dados.email && !dados.email.includes('@')) {
    erros.push('Email inválido');
  }

  if (!dados.contextoArquivo || dados.contextoArquivo.trim().length < 10) {
    erros.push('Contexto da IA deve ter pelo menos 10 caracteres');
  }

  return erros;
}

const erros = validarDadosCliente(dados);
if (erros.length > 0) {
  mostrarErros(erros);
  return;
}

await api.criarCliente(dados);
```

### 4. Cleanup de Intervalos

```javascript
// ✅ BOM: Limpar intervalos em React
function ComponenteWhatsApp({ sessaoId }) {
  useEffect(() => {
    const interval = setInterval(async () => {
      const sessao = await api.buscarSessao(sessaoId);
      // ...
    }, 5000);

    // Cleanup ao desmontar
    return () => clearInterval(interval);
  }, [sessaoId]);
}

// ❌ RUIM: Não limpar intervalos
function ComponenteRuim({ sessaoId }) {
  useEffect(() => {
    setInterval(async () => {
      // ... polling
    }, 5000);
    // Memory leak! Intervalo continua rodando
  }, [sessaoId]);
}
```

### 5. Debounce em Inputs

```javascript
// ✅ BOM: Debounce para busca
function usarDebounce(valor, delay) {
  const [valorDebounced, setValorDebounced] = useState(valor);

  useEffect(() => {
    const handler = setTimeout(() => {
      setValorDebounced(valor);
    }, delay);

    return () => clearTimeout(handler);
  }, [valor, delay]);

  return valorDebounced;
}

function BuscaCliente() {
  const [termo, setTermo] = useState('');
  const termoDebounced = usarDebounce(termo, 500);

  useEffect(() => {
    if (termoDebounced) {
      buscarClientes(termoDebounced);
    }
  }, [termoDebounced]);

  return <input value={termo} onChange={e => setTermo(e.target.value)} />;
}
```

### 6. Cache de Dados

```javascript
// ✅ BOM: Cache simples
class CachedAPI extends WhatsAppBotAPI {
  constructor(baseURL) {
    super(baseURL);
    this.cache = new Map();
  }

  async buscarClienteComCache(id, ttl = 60000) {
    const cacheKey = `cliente_${id}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ttl) {
      console.log('Retornando do cache');
      return cached.data;
    }

    const data = await this.buscarCliente(id);
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }
}
```

### 7. Loading States

```javascript
// ✅ BOM: Gerenciar estados de loading
function ComponenteCriarSessao() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [qrCode, setQRCode] = useState(null);

  const criar = async () => {
    setLoading(true);
    setErro(null);

    try {
      const sessao = await api.criarSessao({ clienteId, whatsappNumero });
      await new Promise(r => setTimeout(r, 3000));
      const qr = await api.obterQRCode(sessao.id);
      setQRCode(qr.qr);
    } catch (error) {
      setErro(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <p>Carregando...</p>}
      {erro && <p>Erro: {erro}</p>}
      {qrCode && <QRCode value={qrCode} />}
      <button onClick={criar} disabled={loading}>Criar Sessão</button>
    </>
  );
}
```

---

## 📚 Resumo Rápido

### Criar Cliente + Sessão Completo

```javascript
const api = new WhatsAppBotAPI('https://api.exemplo.com');

// 1. Criar cliente
const cliente = await api.criarCliente({
  nome: 'Pizzaria XYZ',
  email: 'contato@xyz.com',
  contextoArquivo: 'Você é assistente...'
});

// 2. Criar sessão
const sessao = await api.criarSessao({
  clienteId: cliente.id,
  whatsappNumero: '5511999999999'
});

// 3. Aguardar
await new Promise(r => setTimeout(r, 3000));

// 4. Polling QR Code
const qr = await pollingQRCode(sessao.id);

// 5. Exibir QR Code
exibirQRCode(qr);

// 6. Monitorar status
monitorarStatus(sessao.id, (status) => {
  if (status === 'conectado') {
    alert('Conectado!');
  }
});
```

---

**Documento criado para integração frontend com Bot WhatsApp Multi-Sessão**
**Versão:** 1.0
**Data:** 2025-11-12
**Backend:** Node.js + Express + Baileys + PostgreSQL
