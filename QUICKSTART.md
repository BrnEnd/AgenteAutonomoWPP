# ⚡ Início Rápido - Testes Locais

Setup local em 5 minutos!

---

## 🚀 Setup Automático (Recomendado)

### 1. Execute o script de setup

```bash
./setup-local.sh
```

Este script irá:
- ✅ Iniciar PostgreSQL via Docker
- ✅ Executar schema SQL
- ✅ Criar arquivo .env
- ✅ Instalar dependências npm

### 2. Configure sua GROQ_API_KEY

Edite o arquivo `.env`:

```bash
nano .env
```

Adicione sua chave (obtenha em https://console.groq.com/keys):

```env
GROQ_API_KEY=sua_chave_aqui
```

### 3. Inicie o servidor

```bash
npm start
```

### 4. Teste a API

Em outro terminal:

```bash
./test-api.sh
```

✅ **Pronto!** O sistema está rodando.

---

## 🔧 Setup Manual (Alternativo)

### 1. PostgreSQL via Docker

```bash
docker-compose up -d
```

### 2. Executar Schema

```bash
docker exec -i wpp_postgres_local psql -U postgres -d wppbot < database/schema.sql
```

### 3. Configurar .env

```bash
cp .env.example .env
```

Edite e adicione:
```env
GROQ_API_KEY=sua_chave_aqui
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/wppbot
```

### 4. Instalar e Rodar

```bash
npm install
npm start
```

---

## 🧪 Testando WhatsApp

### 1. Criar Cliente

```bash
curl -X POST http://localhost:3000/clientes \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Minha Empresa",
    "email": "contato@empresa.com",
    "contextoArquivo": "Você é assistente da Minha Empresa."
  }'
```

### 2. Criar Sessão

```bash
curl -X POST http://localhost:3000/sessoes \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": 1,
    "whatsappNumero": "5511999999999"
  }'
```

### 3. Obter QR Code

```bash
# Aguarde 3 segundos
sleep 3

# Obtenha o QR
curl http://localhost:3000/sessoes/1/qr
```

### 4. Escanear QR Code

1. Copie o campo `qr` da resposta
2. Cole em: https://www.qr-code-generator.com/
3. Escaneie com WhatsApp

### 5. Testar Mensagem

Envie uma mensagem pelo WhatsApp. O bot deve responder!

---

## 📊 Comandos Úteis

### Ver Status

```bash
curl http://localhost:3000/status
```

### Ver Logs de Mensagens

```bash
curl http://localhost:3000/sessoes/1/logs
```

### Listar Clientes

```bash
curl http://localhost:3000/clientes
```

### Listar Sessões

```bash
curl http://localhost:3000/sessoes
```

---

## 🛑 Parar Tudo

### Parar servidor

`Ctrl+C` no terminal onde rodou `npm start`

### Parar PostgreSQL

```bash
docker-compose down
```

### Limpar tokens

```bash
rm -rf tokens/
```

---

## 🔍 Ver Logs do Servidor

```bash
npm start
```

Você verá logs como:

```
[BOT] Iniciando sistema multi-sessão...
[DB] ✓ Conexão estabelecida com sucesso
[API] ✓ Servidor rodando na porta 3000
[INIT] Inicializando sessão ID: 1
[QR] QR Code gerado
[STATUS] ✓ Sessão conectada!
```

---

## 🐛 Problemas?

### "Cannot connect to database"

```bash
docker ps  # Verificar se PostgreSQL está rodando
docker logs wpp_postgres_local  # Ver logs
```

### "Port 5432 already in use"

Você já tem PostgreSQL rodando. Pare-o:

```bash
sudo systemctl stop postgresql
```

Ou use porta diferente no `docker-compose.yml`.

### QR Code não aparece

- Aguarde até 5 segundos
- Verifique logs do servidor
- Limpe tokens: `rm -rf tokens/`

---

## 📚 Mais Informações

- **API Completa:** Veja `README.md`
- **Setup Detalhado:** Veja `LOCAL_SETUP.md`
- **Deploy:** Veja `DEPLOY.md`

---

**Tudo funcionando? Hora do deploy! 🚀**

Siga o guia em `DEPLOY.md` para enviar ao Railway.
