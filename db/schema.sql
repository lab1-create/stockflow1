-- schema.sql
-- Estrutura oficial do banco de dados (Produção Segura) - Sincronizado com o Backend (Fase 7)

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('tecnico', 'admin')),
    sector TEXT NOT NULL DEFAULT 'tecnica',
    pin_code TEXT NOT NULL, -- Hasheado com bcrypt
    active BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES app_users(id),
    pending_pin_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    category TEXT,
    sector TEXT NOT NULL DEFAULT 'tecnica',
    supplier TEXT,
    note TEXT,
    minimum_quantity INTEGER NOT NULL DEFAULT 0,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    link TEXT,
    unit_price NUMERIC,
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supply_id UUID REFERENCES supplies(id),
    user_id UUID REFERENCES app_users(id),
    destination_id UUID REFERENCES destinations(id),
    sector TEXT NOT NULL DEFAULT 'tecnica',
    movement_type TEXT NOT NULL CHECK (movement_type IN ('withdrawal', 'return', 'replenishment', 'adjustment')),
    quantity INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS stock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supply_id UUID REFERENCES supplies(id),
    user_id UUID REFERENCES app_users(id),
    destination_id UUID REFERENCES destinations(id),
    sector TEXT NOT NULL DEFAULT 'tecnica',
    quantity INTEGER NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
    approved_by UUID REFERENCES app_users(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    approved_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) - DENY ALL
-- ==========================================
-- O acesso ao banco é restrito exclusivamente ao backend (Node.js) 
-- utilizando a key de serviço (Service Role) que bypassa o RLS.
-- Qualquer acesso direto (ex: Supabase Anon Key no frontend) 
-- será sumariamente bloqueado pelo RLS ativo sem nenhuma política permitida.

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_supplies_code ON supplies(code);
CREATE INDEX IF NOT EXISTS idx_supplies_sector ON supplies(sector);
CREATE INDEX IF NOT EXISTS idx_stock_movements_supply_id ON stock_movements(supply_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sector ON stock_movements(sector);
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_stock_requests_sector ON stock_requests(sector);
