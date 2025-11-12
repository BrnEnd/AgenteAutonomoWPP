#!/bin/bash

# Script de testes da API
# Uso: ./test-api.sh [base_url]

BASE_URL="${1:-http://localhost:3000}"

echo "🧪 Testando API do WhatsApp Bot"
echo "Base URL: $BASE_URL"
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função de teste
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4

    echo -e "${YELLOW}Testando:${NC} $description"
    echo -e "${YELLOW}Endpoint:${NC} $method $endpoint"

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
        echo -e "${GREEN}✓ Status: $http_code${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Status: $http_code${NC}"
        echo "$body"
    fi
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# 1. Health Check
test_endpoint "GET" "/health" "" "Health Check"

# 2. Status do Sistema
test_endpoint "GET" "/status" "" "Status do Sistema"

# 3. Criar Cliente
echo -e "${YELLOW}Criando cliente de teste...${NC}"
CLIENTE_DATA='{
  "nome": "Empresa Teste API",
  "email": "teste.api@empresa.com",
  "telefone": "+5511999998888",
  "contextoArquivo": "Você é um assistente de testes automatizados. Responda sempre: Teste OK!"
}'
test_endpoint "POST" "/clientes" "$CLIENTE_DATA" "Criar Cliente"

# 4. Listar Clientes
test_endpoint "GET" "/clientes" "" "Listar Clientes"

# 5. Buscar Cliente por ID (assumindo ID=1)
test_endpoint "GET" "/clientes/1" "" "Buscar Cliente ID 1"

# 6. Criar Sessão
echo -e "${YELLOW}Criando sessão de teste...${NC}"
SESSAO_DATA='{
  "clienteId": 1,
  "whatsappNumero": "5511999998888"
}'
test_endpoint "POST" "/sessoes" "$SESSAO_DATA" "Criar Sessão"

# 7. Listar Sessões
test_endpoint "GET" "/sessoes" "" "Listar Sessões"

# 8. Buscar Sessão por ID (assumindo ID=1)
test_endpoint "GET" "/sessoes/1" "" "Buscar Sessão ID 1"

# 9. Aguardar e obter QR Code
echo -e "${YELLOW}Aguardando 3 segundos para gerar QR Code...${NC}"
sleep 3
test_endpoint "GET" "/sessoes/1/qr" "" "Obter QR Code"

# 10. Listar Sessões do Cliente
test_endpoint "GET" "/clientes/1/sessoes" "" "Listar Sessões do Cliente 1"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Testes da API concluídos!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📋 Próximos passos manuais:"
echo ""
echo "1. Escaneie o QR Code com WhatsApp"
echo "2. Envie uma mensagem para o número conectado"
echo "3. Verifique logs com: curl $BASE_URL/sessoes/1/logs"
echo ""
