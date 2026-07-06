BEGIN;

-- Remove o Gabriel se ele foi adicionado por engano
DELETE FROM app_users WHERE name = 'Gabriel';

-- Garante as colunas corretas na tabela de usuários
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS pin_code TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Cadastra/Atualiza EXCLUSIVAMENTE seus usuários originais com os PINs corretos
INSERT INTO app_users (name, role, pin_code, active) VALUES
  ('Administrador', 'admin', 'Out@adm', TRUE),
  ('Luiz', 'tecnico', '1111', TRUE),
  ('Bruno', 'tecnico', '1111', TRUE),
  ('Joao', 'tecnico', '1111', TRUE),
  ('Placo', 'tecnico', '1111', TRUE),
  ('Kaique', 'tecnico', '1111', TRUE),
  ('Cauã', 'tecnico', '1111', TRUE)
ON CONFLICT (name) DO UPDATE SET
  role = EXCLUDED.role,
  pin_code = EXCLUDED.pin_code,
  active = TRUE;

-- Cria ou corrige a tabela de destinos (sem usar a coluna "active" que deu erro)
CREATE TABLE IF NOT EXISTS destinations (
  name TEXT PRIMARY KEY
);

-- Limpa destinos antigos e insere os corretos
DELETE FROM destinations;
INSERT INTO destinations (name) VALUES
  ('Bancada 01'),
  ('Bancada 02'),
  ('Bancada 03'),
  ('Bancada 04'),
  ('Bancada 05'),
  ('Bancada 06'),
  ('Servico interno'),
  ('Estoque de testes'),
  ('Teste'),
  ('Outro')
ON CONFLICT (name) DO NOTHING;

COMMIT;
