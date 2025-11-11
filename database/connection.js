const { Pool } = require('pg');
require('dotenv').config();

// =====================================================
// CONFIGURAÇÃO DO POOL DE CONEXÕES POSTGRESQL
// =====================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Railway usa SSL
  } : false,
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Evento de erro do pool
pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool de conexões:', err);
});

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

/**
 * Executa uma query no banco de dados
 * @param {string} text - Query SQL
 * @param {Array} params - Parâmetros da query
 * @returns {Promise<Object>} Resultado da query
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[DB] Query executada', { text: text.substring(0, 50), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('[DB] Erro na query:', { text, error: error.message });
    throw error;
  }
}

/**
 * Testa a conexão com o banco de dados
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as now, current_database() as database');
    console.log('[DB] ✓ Conexão estabelecida com sucesso');
    console.log('[DB] Database:', result.rows[0].database);
    console.log('[DB] Timestamp:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('[DB] ✗ Falha na conexão:', error.message);
    return false;
  }
}

/**
 * Encerra o pool de conexões
 */
async function close() {
  try {
    await pool.end();
    console.log('[DB] Pool de conexões encerrado');
  } catch (error) {
    console.error('[DB] Erro ao encerrar pool:', error.message);
  }
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

module.exports = {
  query,
  pool,
  testConnection,
  close
};
