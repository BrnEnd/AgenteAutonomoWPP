# 🧪 Setup Local para Testes

Este guia explica como rodar o projeto localmente antes do deploy.

---

## Opção 1: PostgreSQL Local via Docker (Mais Fácil)

### 1. Instalar Docker

Se não tiver Docker instalado:
- **Linux:** `sudo apt install docker.io docker-compose`
- **Mac/Windows:** Baixe Docker Desktop

### 2. Criar arquivo docker-compose.yml

Crie na raiz do projeto:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: wpp_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres123
      POSTGRES_DB: wppbot
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 3. Iniciar PostgreSQL

```bash
docker-compose up -d
```

Verificar se está rodando:
```bash
docker ps
```

### 4. Executar Schema SQL

```bash
# Via psql (se tiver instalado)
psql postgresql://postgres:postgres123@localhost:5432/wppbot < database/schema.sql

# OU via Docker
docker exec -i wpp_postgres psql -U postgres -d wppbot < database/schema.sql
```

### 5. Criar .env

```bash
cp .env.example .env
```

Edite `.env`:

```env
PORT=3000

# Sua chave Groq (obtenha em https://console.groq.com/keys)
GROQ_API_KEY=sua_chave_groq_aqui
GROQ_MODEL=llama-3.1-8b-instant

# PostgreSQL Local
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/wppbot

NODE_ENV=development
```

### 6. Instalar Dependências

```bash
npm install
```

### 7. Rodar o Bot

```bash
npm start
```

Ou em modo desenvolvimento (auto-reload):
```bash
npm run dev
```

### 8. Testar a API

Abra outro terminal e teste:

```bash
# Health check
curl http://localhost:3000/health

# Status
curl http://localhost:3000/status
```

---

## Opção 2: PostgreSQL no Railway (Teste Remoto)

Se preferir usar diretamente o PostgreSQL do Railway:

### 1. Criar PostgreSQL no Railway

1. Acesse https://railway.app
2. Crie novo projeto
3. Adicione PostgreSQL
4. Copie a `DATABASE_URL`

### 2. Executar Schema

Via Railway Dashboard:
1. Clique no PostgreSQL
2. Vá em "Query"
3. Cole o conteúdo de `database/schema.sql`
4. Execute

### 3. Configurar .env

```env
PORT=3000
GROQ_API_KEY=sua_chave_groq
GROQ_MODEL=llama-3.1-8b-instant

# Cole a DATABASE_URL do Railway
DATABASE_URL=postgresql://postgres:senha@containers-us-west-xxx.railway.app:5432/railway

NODE_ENV=development
```

### 4. Instalar e Rodar

```bash
npm install
npm start
```

---

## 🧪 Testando Funcionalidades

### 1. Criar Cliente de Teste

```bash
curl -X POST http://localhost:3000/clientes \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste Local",
    "email": "teste@local.com",
    "telefone": "+5511999999999",
    "contextoArquivo": "Você é um assistente de testes. Seja educado e responda: Olá! Estou funcionando corretamente."
  }'
```

Resposta esperada:
```json
{
  "id": 1,
  "nome": "Teste Local",
  "email": "teste@local.com",
  "ativo": true,
  "created_at": "..."
}
```

### 2. Listar Clientes

```bash
curl http://localhost:3000/clientes
```

### 3. Criar Sessão WhatsApp

```bash
curl -X POST http://localhost:3000/sessoes \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": 1,
    "whatsappNumero": "5511999999999"
  }'
```

### 4. Obter QR Code

Aguarde 3 segundos e:

```bash
curl http://localhost:3000/sessoes/1/qr
```

Você receberá um QR Code em formato texto. Para visualizar:

1. Copie o campo `qr`
2. Acesse: https://www.qr-code-generator.com/
3. Cole o texto
4. Escaneia com WhatsApp no celular

### 5. Verificar Status

```bash
curl http://localhost:3000/sessoes/1
```

Quando conectar, `status` mudará para `"conectado"`.

### 6. Testar Mensagem

Envie uma mensagem pelo WhatsApp para o número conectado.

O bot deve responder com base no `contextoArquivo` do cliente.

### 7. Ver Logs

```bash
curl http://localhost:3000/sessoes/1/logs
```

---

## 🔍 Monitorar Logs do Servidor

Ao rodar `npm start`, você verá logs como:

```
[BOT] Iniciando sistema multi-sessão...
[BOT] Testando conexão com PostgreSQL...
[DB] ✓ Conexão estabelecida com sucesso
[DB] Database: wppbot
[API] ✓ Servidor rodando na porta 3000
[API] Provider: Groq (llama-3.1-8b-instant)
[API] Library: Baileys (Multi-Sessão)
[API] Database: PostgreSQL
[API] Sessões ativas: 0
```

Quando criar uma sessão:
```
[INIT] Inicializando sessão ID: 1
[INIT] Session: session_5511999999999_1234567890, Cliente: Teste Local
[QR] QR Code gerado para session_5511999999999_1234567890
[STATUS] ✓ Sessão session_5511999999999_1234567890 conectada!
```

Quando receber mensagem:
```
[MESSAGE] [session_5511999999999_1234567890] De 5511987654321@s.whatsapp.net:
[MESSAGE] "Olá"
[GROQ] Consultando Groq AI...
[RESPONSE] [session_5511999999999_1234567890] Resposta em 1234ms
[SENT] [session_5511999999999_1234567890] Mensagem enviada
```

---

## 🗑️ Limpar Ambiente Local

### Parar e remover PostgreSQL

```bash
docker-compose down

# Para remover dados também:
docker-compose down -v
```

### Limpar tokens do WhatsApp

```bash
rm -rf tokens/
```

---

## 🐛 Troubleshooting Local

### Erro: "Cannot connect to database"

**Solução:**
```bash
# Verificar se PostgreSQL está rodando
docker ps

# Ver logs do PostgreSQL
docker logs wpp_postgres

# Testar conexão
psql postgresql://postgres:postgres123@localhost:5432/wppbot
```

### Erro: "Port 5432 already in use"

Já tem PostgreSQL rodando localmente. Opções:

1. Usar outro porta no docker-compose.yml:
```yaml
ports:
  - "5433:5432"  # Porta 5433 no host
```

E atualizar `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5433/wppbot
```

2. Ou parar o PostgreSQL local:
```bash
sudo systemctl stop postgresql
```

### Erro: "GROQ_API_KEY inválida"

- Verifique se copiou a chave corretamente do Groq Console
- Não deve ter espaços ou quebras de linha
- Gere nova chave se necessário

### QR Code não aparece

- Aguarde até 5 segundos
- Verifique logs do servidor
- Tente deletar `tokens/` e recriar a sessão

---

## ✅ Checklist de Teste Local

Antes de fazer deploy, verifique:

- [ ] PostgreSQL rodando (local ou Railway)
- [ ] Schema SQL executado com sucesso
- [ ] Dependências instaladas (`npm install`)
- [ ] `.env` configurado corretamente
- [ ] Servidor inicia sem erros
- [ ] `GET /health` retorna status ok
- [ ] Consegue criar cliente
- [ ] Consegue criar sessão
- [ ] QR Code é gerado
- [ ] WhatsApp conecta com sucesso
- [ ] Bot recebe e responde mensagens
- [ ] Logs são salvos no banco

---

## 🚀 Após Testes Locais

Tudo funcionando? Hora do deploy!

1. Commitar alterações (se houver)
2. Push para o repositório
3. Seguir o `DEPLOY.md` para Railway

---

**Bons testes! 🧪**
