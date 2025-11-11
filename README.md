# Agente Autônomo WhatsApp

Bot de WhatsApp construído com [Baileys](https://github.com/WhiskeySockets/Baileys) e Groq que suporta múltiplas sessões simultâneas.
Cada sessão mantém seu próprio contexto opcional (documentos de instruções para a LLM) e persiste metadados, histórico de mensagens e eventos no Supabase.

## Principais funcionalidades

- ✅ **Múltiplas sessões**: cada sessão utiliza uma pasta dedicada em `./tokens/<sessionId>` para armazenar credenciais do WhatsApp Web.
- ✅ **Contexto customizável**: ao criar uma sessão é possível enviar um campo `context` para personalizar as respostas da IA.
- ✅ **Persistência no Supabase**: sessões, mensagens e eventos são gravados em tabelas próprias, permitindo auditoria completa.
- ✅ **Restauração automática**: sessões marcadas como `auto_restart` são reativadas quando o servidor reinicia.
- ✅ **API REST** para criação, consulta, envio de mensagens e encerramento de sessões.
- ✅ **QR Code no terminal** graças ao [`qrcode-terminal`](https://github.com/gtanner/qrcode-terminal), mantendo o fluxo de pareamento tradicional do Baileys.

## Requisitos

- Node.js 20 ou superior
- Conta Supabase (PostgreSQL) com acesso ao banco de dados
- Chave da API da Groq (`GROQ_API_KEY`)

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto contendo:

```env
PORT=3000
LOG_LEVEL=info
SESSION_LOG_LEVEL=info
TOKENS_PATH=./tokens

GROQ_API_KEY=sua_chave_groq
GROQ_MODEL=llama-3.1-8b-instant

# Credenciais Supabase
SUPABASE_URL=https://<sua-instancia>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
SUPABASE_DB_URL=postgresql://usuario:senha@host:5432/postgres
```

- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são utilizados pelo SDK oficial para inserções/consultas.
- `SUPABASE_DB_URL` é usada somente pelo script de migrações para executar SQL diretamente no Postgres.

## Instalação

```bash
npm install
```

> Caso esteja em um ambiente sem acesso à internet, execute `npm install` localmente antes de fazer o deploy para garantir que as dependências `@supabase/supabase-js` e `pg` sejam instaladas.

## Banco de dados

As tabelas necessárias estão definidas em `supabase/migrations/0001_create_tables.sql`.
Para aplicar as migrações execute:

```bash
npm run db:migrate
```

Certifique-se de que `SUPABASE_DB_URL` esteja configurada com o connection string do Postgres da sua instância Supabase.

### Tabelas criadas

- `sessions`: estado atual de cada sessão do WhatsApp.
- `messages`: histórico de mensagens recebidas/enviadas por sessão.
- `events`: log de QR codes, reconexões, erros e outras ocorrências.

## Execução

```bash
npm run dev # desenvolvimento com nodemon
# ou
npm start
```

Ao iniciar o servidor você pode criar novas sessões através da API REST.

## Endpoints principais

| Método | Rota | Descrição |
| ------ | ---- | --------- |
| `POST` | `/sessions` | Cria e inicia uma nova sessão. Body: `{ "sessionId": "suapessoa", "context": "instruções opcionais", "displayName": "Meu Bot", "autoRestart": true }` |
| `GET` | `/sessions` | Lista todas as sessões carregadas em memória. |
| `GET` | `/sessions/:id/status` | Consulta o estado de uma sessão específica. |
| `GET` | `/sessions/:id/qr` | Obtém o último QR Code gerado para a sessão. |
| `PATCH` | `/sessions/:id` | Atualiza `context`, `displayName` ou `autoRestart`. |
| `POST` | `/sessions/:id/send` | Envia uma mensagem manual `{ "remoteJid": "5511999999999@s.whatsapp.net", "message": "Olá" }`. |
| `DELETE` | `/sessions/:id` | Encerra a sessão e opcionalmente remove tokens (`?removeTokens=true`). |

Além disso, `GET /health` retorna dados de monitoramento do processo e `GET /status` agrega o estado de todas as sessões.

## Fluxo de mensagens

1. Mensagens recebidas (`messages.upsert`) são gravadas no Supabase e encaminhadas para a Groq.
2. O contexto definido na criação da sessão é concatenado ao prompt do sistema para personalizar respostas.
3. A resposta da IA é enviada ao usuário, registrada como mensagem de saída e um evento é salvo para auditoria.

## Estrutura de pastas

```
.
├── index.js
├── src
│   ├── ai
│   │   └── groq.js
│   ├── db
│   │   ├── repository.js
│   │   └── supabase.js
│   └── sessions
│       └── WhatsAppSession.js
├── scripts
│   └── runMigrations.js
└── supabase
    └── migrations
        └── 0001_create_tables.sql
```

## Próximos passos

- Adicionar políticas de Row Level Security (RLS) no Supabase caso exponha as tabelas via API pública.
- Criptografar a pasta `tokens` ou utilizar um cofre de segredos para armazenar credenciais sensíveis.

Com essa base você consegue hospedar diversos números do WhatsApp simultaneamente, preservando histórico completo e contexto individual para cada instância do bot.
