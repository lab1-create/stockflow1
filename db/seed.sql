BEGIN;

INSERT INTO app_users (name, role, pin_code) VALUES
  ('Administrador', 'admin', '0000'),
  ('Luiz', 'tecnico', '1111'),
  ('Henrique', 'tecnico', '1111'),
  ('Joao', 'tecnico', '1111'),
  ('Gabriel', 'tecnico', '1111')
ON CONFLICT (name) DO UPDATE SET
  role = EXCLUDED.role,
  pin_code = EXCLUDED.pin_code,
  active = TRUE;

INSERT INTO destinations (name) VALUES
  ('Bancada 01'),
  ('Bancada 02'),
  ('Bancada 03'),
  ('Bancada 04'),
  ('Servico interno'),
  ('Estoque de testes'),
  ('Outro'),
  ('Estoque')
ON CONFLICT (name) DO NOTHING;

COMMIT;
