# Use Node 18 com suporte a Puppeteer
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# Definir diretório de trabalho
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências como root
USER root
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Criar diretórios necessários
RUN mkdir -p /app/tokens /app/logs && \
    chown -R pptruser:pptruser /app

# Voltar para usuário não-root
USER pptruser

# Expor porta
EXPOSE 3000

# Variáveis de ambiente do Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Comando de inicialização
CMD ["node", "index.js"]