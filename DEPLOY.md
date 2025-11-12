# 🚂 Guia de Deploy no Railway

Este guia detalha o processo completo de deploy do sistema no Railway.

---

## 📋 Pré-requisitos

- Conta no Railway (https://railway.app)
- Repositório Git (GitHub, GitLab, etc.)
- GROQ_API_KEY (https://console.groq.com/keys)

---

## 🚀 Passo a Passo

### 1. Criar Projeto no Railway

1. Acesse https://railway.app
2. Clique em "New Project"
3. Escolha "Deploy from GitHub repo"
4. Selecione o repositório `AgenteAutonomoWPP`
5. Railway iniciará o deploy automaticamente

### 2. Adicionar PostgreSQL

1. No dashboard do projeto, clique em "+ New"
2. Selecione "Database" → "Add PostgreSQL"
3. Railway criará o banco e definirá `DATABASE_URL` automaticamente

### 3. Configurar Variáveis de Ambiente

No seu serviço Node.js:

1. Clique na aba "Variables"
2. Adicione as seguintes variáveis:

```
GROQ_API_KEY=sua_chave_groq_aqui
GROQ_MODEL=llama-3.1-8b-instant
NODE_ENV=production
```

**Nota:** `DATABASE_URL` já está configurada automaticamente pelo Railway.

### 4. Executar Schema SQL

**Opção A - Via Railway Dashboard (Recomendado):**

1. Clique no serviço PostgreSQL
2. Vá em "Query"
3. Copie TODO o conteúdo do arquivo `database/schema.sql`
4. Cole no editor
5. Clique em "Run Query"
6. Verifique se aparece "Success"

**Opção B - Via Railway CLI:**

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Conectar ao projeto
railway link

# Executar schema
railway run psql < database/schema.sql
```

### 5. Verificar Deploy

1. Aguarde o deploy finalizar (1-2 minutos)
2. Railway fornecerá uma URL pública (ex: `https://seu-app.up.railway.app`)
3. Teste a API:

```bash
curl https://seu-app.up.railway.app/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "library": "Baileys",
  "activeSessions": 0
}
```

---

## 🔍 Verificar Logs

### Via Dashboard:
1. Clique no serviço Node.js
2. Vá em "Deployments"
3. Clique no deployment ativo
4. Veja os logs em tempo real

### Via CLI:
```bash
railway logs
```

Logs esperados no início:
```
[BOT] Iniciando sistema multi-sessão...
[BOT] Testando conexão com PostgreSQL...
[DB] ✓ Conexão estabelecida com sucesso
[DB] Database: railway
[API] ✓ Servidor rodando na porta 3000
[API] Library: Baileys (Multi-Sessão)
[API] Database: PostgreSQL
```

---

## 🛠️ Configurações Adicionais

### Domínio Customizado

1. No dashboard do serviço, vá em "Settings"
2. Clique em "Generate Domain" (Railway fornece um domínio)
3. Ou adicione seu domínio customizado em "Custom Domain"

### Variáveis de Ambiente Adicionais

Se quiser customizar:

```env
PORT=3000  # Railway define automaticamente, não precisa adicionar
```

---

## 🧪 Testar o Sistema

### 1. Criar Cliente de Teste

```bash
curl -X POST https://seu-app.up.railway.app/clientes \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Empresa Teste",
    "email": "teste@empresa.com",
    "telefone": "+5511999999999",
    "contextoArquivo": "Você é um assistente da Empresa Teste. Seja educado e prestativo."
  }'
```

### 2. Criar Sessão WhatsApp

```bash
curl -X POST https://seu-app.up.railway.app/sessoes \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": 1,
    "whatsappNumero": "5511999999999"
  }'
```

### 3. Obter QR Code

Aguarde 3 segundos e:

```bash
curl https://seu-app.up.railway.app/sessoes/1/qr
```

Copie o campo `qr` e cole em: https://qr-code-generator.com/qr-decoder/

Ou use uma biblioteca para exibir no frontend.

---

## 🔐 Segurança

### Recomendações:

1. **Nunca commite** o arquivo `.env` no Git
2. **Adicione** `.env` no `.gitfile` (já está)
3. **Proteja** as rotas com autenticação (implementar futuramente)
4. **Use HTTPS** sempre (Railway fornece automaticamente)

---

## 📊 Monitoramento

### Métricas no Railway:

1. CPU e Memória: Dashboard → Metrics
2. Logs: Dashboard → Logs
3. Database Size: PostgreSQL → Metrics

### Logs de Mensagens:

```bash
curl https://seu-app.up.railway.app/sessoes/1/logs?limit=50
```

---

## 🔄 Atualizar Deployment

### Via Git:

```bash
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```

Railway detecta o push e faz redeploy automaticamente.

### Via Railway CLI:

```bash
railway up
```

---

## 🐛 Troubleshooting

### Erro: "Falha ao conectar ao banco de dados"

**Solução:**
1. Verifique se o PostgreSQL está rodando no Railway
2. Confirme que `DATABASE_URL` existe nas variáveis
3. Teste conexão via Railway CLI:
```bash
railway run psql
```

### Erro: "GROQ_API_KEY inválida"

**Solução:**
1. Verifique se a variável está definida
2. Gere nova chave em https://console.groq.com/keys
3. Atualize a variável no Railway

### Deploy travado

**Solução:**
1. Vá em "Deployments"
2. Clique nos 3 pontos do deployment travado
3. Clique em "Cancel"
4. Faça novo deploy:
```bash
git commit --allow-empty -m "redeploy"
git push
```

### Tabelas não existem

**Solução:**
Execute novamente o schema.sql:
```bash
railway run psql < database/schema.sql
```

---

## 📝 Backup do Banco

### Fazer backup:

```bash
railway run pg_dump > backup.sql
```

### Restaurar backup:

```bash
railway run psql < backup.sql
```

---

## 💰 Custos

**Railway Free Tier:**
- $5 de crédito/mês grátis
- Suficiente para 1-2 sessões ativas
- Banco de dados PostgreSQL incluído

**Railway Pro ($20/mês):**
- $20 de crédito/mês
- Suporte a mais sessões simultâneas
- Melhor performance

---

## 🎯 Próximos Passos

Após deploy bem-sucedido:

1. ✅ Criar clientes via API
2. ✅ Criar sessões WhatsApp
3. ✅ Testar envio/recebimento de mensagens
4. ✅ Implementar frontend para gerenciar clientes
5. ⏳ Implementar autenticação na API
6. ⏳ Implementar webhooks para notificações
7. ⏳ Implementar expurgo automático de logs

---

**Deploy concluído com sucesso! 🎉**
