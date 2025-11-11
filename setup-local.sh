#!/bin/bash

# Script de setup local do WhatsApp Bot Multi-Sessão
# Autor: Claude
# Uso: ./setup-local.sh

set -e

echo "🚀 Iniciando setup local do WhatsApp Bot..."
echo ""

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado. Por favor, instale o Docker primeiro."
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose não encontrado. Por favor, instale o docker-compose primeiro."
    exit 1
fi

echo "✅ Docker e docker-compose encontrados"
echo ""

# Iniciar PostgreSQL
echo "📦 Iniciando PostgreSQL via Docker..."
docker-compose up -d

echo "⏳ Aguardando PostgreSQL iniciar (10 segundos)..."
sleep 10

# Verificar se PostgreSQL está rodando
if ! docker ps | grep -q wpp_postgres_local; then
    echo "❌ Erro ao iniciar PostgreSQL"
    exit 1
fi

echo "✅ PostgreSQL rodando"
echo ""

# Executar schema SQL
echo "🗄️  Executando schema SQL..."
if [ -f "database/schema.sql" ]; then
    docker exec -i wpp_postgres_local psql -U postgres -d wppbot < database/schema.sql
    echo "✅ Schema SQL executado com sucesso"
else
    echo "❌ Arquivo database/schema.sql não encontrado"
    exit 1
fi
echo ""

# Criar .env se não existir
if [ ! -f ".env" ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.example .env

    # Atualizar DATABASE_URL no .env
    sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/wppbot|' .env

    echo "✅ Arquivo .env criado"
    echo "⚠️  IMPORTANTE: Edite o arquivo .env e adicione sua GROQ_API_KEY"
    echo "   Obtenha em: https://console.groq.com/keys"
else
    echo "ℹ️  Arquivo .env já existe"
fi
echo ""

# Instalar dependências
echo "📦 Instalando dependências npm..."
if [ -f "package.json" ]; then
    npm install
    echo "✅ Dependências instaladas"
else
    echo "❌ package.json não encontrado"
    exit 1
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup local concluído com sucesso!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Edite o arquivo .env e adicione sua GROQ_API_KEY:"
echo "   nano .env"
echo ""
echo "2. Inicie o servidor:"
echo "   npm start"
echo ""
echo "3. Em outro terminal, teste a API:"
echo "   curl http://localhost:3000/health"
echo ""
echo "4. Consulte LOCAL_SETUP.md para mais informações"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🗄️  Conexão PostgreSQL local:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   User: postgres"
echo "   Password: postgres123"
echo "   Database: wppbot"
echo ""
echo "🛑 Para parar o PostgreSQL:"
echo "   docker-compose down"
echo ""
