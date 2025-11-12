const db = require('./connection');

// =====================================================
// QUERIES - CLIENTES
// =====================================================

/**
 * Criar novo cliente
 */
async function createCliente(nome, email, telefone, contextoArquivo) {
  const query = `
    INSERT INTO clientes (nome, email, telefone, contexto_arquivo)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await db.query(query, [nome, email, telefone, contextoArquivo]);
  return result.rows[0];
}

/**
 * Buscar cliente por ID
 */
async function getClienteById(id) {
  const query = 'SELECT * FROM clientes WHERE id = $1';
  const result = await db.query(query, [id]);
  return result.rows[0];
}

/**
 * Buscar todos os clientes ativos
 */
async function getAllClientes(apenasAtivos = true) {
  const query = apenasAtivos
    ? 'SELECT * FROM clientes WHERE ativo = true ORDER BY created_at DESC'
    : 'SELECT * FROM clientes ORDER BY created_at DESC';
  const result = await db.query(query);
  return result.rows;
}

/**
 * Atualizar contexto do cliente
 */
async function updateClienteContexto(id, contextoArquivo) {
  const query = `
    UPDATE clientes
    SET contexto_arquivo = $1
    WHERE id = $2
    RETURNING *
  `;
  const result = await db.query(query, [contextoArquivo, id]);
  return result.rows[0];
}

/**
 * Atualizar dados do cliente
 */
async function updateCliente(id, { nome, email, telefone, ativo }) {
  const query = `
    UPDATE clientes
    SET nome = COALESCE($1, nome),
        email = COALESCE($2, email),
        telefone = COALESCE($3, telefone),
        ativo = COALESCE($4, ativo)
    WHERE id = $5
    RETURNING *
  `;
  const result = await db.query(query, [nome, email, telefone, ativo, id]);
  return result.rows[0];
}

/**
 * Deletar cliente (soft delete)
 */
async function deleteCliente(id) {
  const query = 'UPDATE clientes SET ativo = false WHERE id = $1 RETURNING *';
  const result = await db.query(query, [id]);
  return result.rows[0];
}

// =====================================================
// QUERIES - SESSÕES
// =====================================================

/**
 * Criar nova sessão
 */
async function createSessao(clienteId, whatsappNumero, sessionName) {
  const query = `
    INSERT INTO sessoes (cliente_id, whatsapp_numero, session_name, status)
    VALUES ($1, $2, $3, 'desconectado')
    RETURNING *
  `;
  const result = await db.query(query, [clienteId, whatsappNumero, sessionName]);
  return result.rows[0];
}

/**
 * Buscar sessão por ID
 */
async function getSessaoById(id) {
  const query = `
    SELECT s.*, c.contexto_arquivo, c.nome as cliente_nome, c.ativo as cliente_ativo
    FROM sessoes s
    JOIN clientes c ON s.cliente_id = c.id
    WHERE s.id = $1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
}

/**
 * Buscar sessão por session_name
 */
async function getSessaoBySessionName(sessionName) {
  const query = `
    SELECT s.*, c.contexto_arquivo, c.nome as cliente_nome, c.ativo as cliente_ativo
    FROM sessoes s
    JOIN clientes c ON s.cliente_id = c.id
    WHERE s.session_name = $1
  `;
  const result = await db.query(query, [sessionName]);
  return result.rows[0];
}

/**
 * Buscar sessão por número WhatsApp
 */
async function getSessaoByWhatsappNumero(whatsappNumero) {
  const query = `
    SELECT s.*, c.contexto_arquivo, c.nome as cliente_nome, c.ativo as cliente_ativo
    FROM sessoes s
    JOIN clientes c ON s.cliente_id = c.id
    WHERE s.whatsapp_numero = $1
  `;
  const result = await db.query(query, [whatsappNumero]);
  return result.rows[0];
}

/**
 * Buscar todas as sessões de um cliente
 */
async function getSessoesByCliente(clienteId) {
  const query = 'SELECT * FROM sessoes WHERE cliente_id = $1 ORDER BY created_at DESC';
  const result = await db.query(query, [clienteId]);
  return result.rows;
}

/**
 * Buscar sessões por status
 */
async function getSessoesByStatus(status) {
  const query = `
    SELECT s.*, c.contexto_arquivo, c.nome as cliente_nome, c.ativo as cliente_ativo
    FROM sessoes s
    JOIN clientes c ON s.cliente_id = c.id
    WHERE s.status = $1 AND c.ativo = true
    ORDER BY s.ultimo_uso DESC
  `;
  const result = await db.query(query, [status]);
  return result.rows;
}

/**
 * Atualizar status da sessão
 */
async function updateSessaoStatus(id, status, qrCode = null) {
  const query = `
    UPDATE sessoes
    SET status = $1, qr_code = $2, ultimo_uso = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;
  const result = await db.query(query, [status, qrCode, id]);
  return result.rows[0];
}

/**
 * Atualizar QR Code da sessão
 */
async function updateSessaoQRCode(sessionName, qrCode) {
  const query = `
    UPDATE sessoes
    SET qr_code = $1, status = 'aguardando_qr'
    WHERE session_name = $2
    RETURNING *
  `;
  const result = await db.query(query, [qrCode, sessionName]);
  return result.rows[0];
}

/**
 * Deletar sessão
 */
async function deleteSessao(id) {
  const query = 'DELETE FROM sessoes WHERE id = $1 RETURNING *';
  const result = await db.query(query, [id]);
  return result.rows[0];
}

// =====================================================
// QUERIES - LOGS DE MENSAGENS
// =====================================================

/**
 * Salvar log de mensagem
 */
async function logMensagem(sessaoId, sender, mensagem, tipo, respostaTempoMs = null) {
  const query = `
    INSERT INTO mensagens_log (sessao_id, sender, mensagem, tipo, resposta_tempo_ms)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await db.query(query, [sessaoId, sender, mensagem, tipo, respostaTempoMs]);
  return result.rows[0];
}

/**
 * Buscar logs de uma sessão
 */
async function getLogsBySessao(sessaoId, limit = 100) {
  const query = `
    SELECT * FROM mensagens_log
    WHERE sessao_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const result = await db.query(query, [sessaoId, limit]);
  return result.rows;
}

/**
 * Buscar logs de um usuário específico em uma sessão
 */
async function getLogsBySender(sessaoId, sender, limit = 50) {
  const query = `
    SELECT * FROM mensagens_log
    WHERE sessao_id = $1 AND sender = $2
    ORDER BY created_at DESC
    LIMIT $3
  `;
  const result = await db.query(query, [sessaoId, sender, limit]);
  return result.rows;
}

/**
 * TODO: Implementar mecanismo de expurgo automático
 * Deletar logs antigos (mais de X dias)
 */
async function expurgarLogsAntigos(diasRetencao = 30) {
  const query = `
    DELETE FROM mensagens_log
    WHERE created_at < NOW() - INTERVAL '${diasRetencao} days'
    RETURNING count(*)
  `;
  const result = await db.query(query);
  return result.rowCount;
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

module.exports = {
  // Clientes
  createCliente,
  getClienteById,
  getAllClientes,
  updateClienteContexto,
  updateCliente,
  deleteCliente,

  // Sessões
  createSessao,
  getSessaoById,
  getSessaoBySessionName,
  getSessaoByWhatsappNumero,
  getSessoesByCliente,
  getSessoesByStatus,
  updateSessaoStatus,
  updateSessaoQRCode,
  deleteSessao,

  // Logs
  logMensagem,
  getLogsBySessao,
  getLogsBySender,
  expurgarLogsAntigos,
};
