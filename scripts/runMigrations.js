#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error('[MIGRATIONS] Defina SUPABASE_DB_URL para executar as migrações.');
    process.exit(1);
  }

  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('[MIGRATIONS] Pasta de migrações não encontrada:', migrationsDir);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[MIGRATIONS] Nenhuma migração para executar.');
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      console.log(`[MIGRATIONS] Executando ${file}...`);
      await client.query(sql);
    }
    console.log('[MIGRATIONS] Migrações concluídas com sucesso.');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('[MIGRATIONS] Erro ao executar migrações:', error.message);
  process.exit(1);
});
