require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // 1. Inserir bancadas
    const bancadas = [
      'Bancada 1', 'Bancada 2', 'Bancada 3', 'Bancada 4', 
      'Bancada 5', 'Bancada 6', 'Bancada 7', 'Laboratório'
    ];
    
    // Deletar as antigas "Bancada 01" para padronizar como "Bancada 1" (se não estiver em uso)
    // Na verdade, vamos inserir as faltantes e garantir que existem com o nome exato do prompt.
    // O prompt diz "BANCADA 1", "BANCADA 2"... vamos usar "Bancada 1"
    for (const b of bancadas) {
      await client.query(`
        INSERT INTO destinations (name, active) 
        SELECT $1, true 
        WHERE NOT EXISTS (SELECT 1 FROM destinations WHERE name = $1);
      `, [b]);
    }

    // 2. Adicionar coluna na tabela app_users
    await client.query(`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS default_destination_id UUID REFERENCES destinations(id);
    `);

    // 3. Atualizar cada usuário
    const mapping = {
      'Luiz': 'Bancada 1',
      'Bruno': 'Bancada 2',
      'Cauã': 'Bancada 3',
      'Placo': 'Bancada 4',
      'Kaique': 'Bancada 5',
      'Fabricio': 'Bancada 6',
      'João': 'Bancada 7'
    };

    for (const [userName, bancadaName] of Object.entries(mapping)) {
      await client.query(`
        UPDATE app_users 
        SET default_destination_id = (SELECT id FROM destinations WHERE name = $2 LIMIT 1)
        WHERE name ILIKE $1 || '%';
      `, [userName, bancadaName]);
    }

    console.log("Banco de dados atualizado com bancadas e mapeamento de usuários.");
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
main();
