-- =====================================================
-- SCHEMA: Sistema de Chatbot WhatsApp Multi-Cliente
-- Database: PostgreSQL (Railway)
-- =====================================================

-- 1. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    telefone VARCHAR(20),
    ativo BOOLEAN DEFAULT true,

    -- Arquivo de contexto (JSON ou TEXT)
    -- Este campo será usado como System Prompt para a IA
    contexto_arquivo TEXT NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes para busca rápida
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo);

-- =====================================================

-- 2. TABELA DE SESSÕES WHATSAPP
CREATE TABLE IF NOT EXISTS sessoes (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,

    -- Identificação da sessão
    whatsapp_numero VARCHAR(20) NOT NULL UNIQUE,
    session_name VARCHAR(100) NOT NULL UNIQUE,

    -- QR Code e Status
    qr_code TEXT,
    status VARCHAR(20) DEFAULT 'desconectado'
        CHECK (status IN ('conectado', 'desconectado', 'aguardando_qr')),

    -- Controle de uso
    ultimo_uso TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_sessoes_cliente_id ON sessoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_whatsapp_numero ON sessoes(whatsapp_numero);
CREATE INDEX IF NOT EXISTS idx_sessoes_status ON sessoes(status);
CREATE INDEX IF NOT EXISTS idx_sessoes_session_name ON sessoes(session_name);

-- =====================================================

-- 3. TABELA DE LOG DE MENSAGENS (Auditoria)
-- TODO: Implementar mecanismo de expurgo automático para logs antigos
CREATE TABLE IF NOT EXISTS mensagens_log (
    id BIGSERIAL PRIMARY KEY,
    sessao_id INTEGER NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,

    -- Dados da mensagem
    sender VARCHAR(50) NOT NULL,
    mensagem TEXT NOT NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('recebida', 'enviada')),

    -- Metadata
    resposta_tempo_ms INTEGER, -- tempo de resposta da IA em ms

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes para queries de log
CREATE INDEX IF NOT EXISTS idx_mensagens_sessao_id ON mensagens_log(sessao_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at ON mensagens_log(created_at);
CREATE INDEX IF NOT EXISTS idx_mensagens_sender ON mensagens_log(sender);

-- =====================================================

-- 4. FUNÇÃO PARA ATUALIZAR updated_at AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessoes_updated_at ON sessoes;
CREATE TRIGGER update_sessoes_updated_at
    BEFORE UPDATE ON sessoes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================

-- 5. DADOS DE EXEMPLO (Opcional - comentar em produção)
-- INSERT INTO clientes (nome, email, telefone, contexto_arquivo) VALUES
-- ('Empresa Demo', 'contato@demo.com', '+5511999999999',
-- 'Você é um assistente virtual brasileiro simpático e prestativo da Empresa Demo.
-- Responda de forma clara, direta e natural, como se estivesse conversando pelo WhatsApp.
-- Use português brasileiro, seja objetivo e evite respostas muito longas.

-- Produtos disponíveis:
-- - Produto A: R$ 100,00
-- - Produto B: R$ 200,00
-- - Produto C: R$ 300,00

-- Horário de atendimento: Segunda a Sexta, 9h às 18h.
-- Email de suporte: suporte@demo.com
-- Telefone: (11) 99999-9999');

-- INSERT INTO sessoes (cliente_id, whatsapp_numero, session_name, status) VALUES
-- (1, '5511999999999', 'demo_session_001', 'desconectado');
