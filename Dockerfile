# Usar Node 20 Alpine (requerido pelo Baileys)
FROM node:20-alpine

# Instalar apenas dependências básicas
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Definir diretório de trabalho
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências do Node
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Criar diretórios necessários
RUN mkdir -p /app/tokens /app/logs

# Expor porta
EXPOSE 3000

# Comando de inicialização
CMD ["node", "index.js"]