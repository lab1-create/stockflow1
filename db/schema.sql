-- schema.sql
-- Estrutura oficial do banco de dados (Produção Segura) - Sincronizado com o Backend (Fase 7)

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('tecnico', 'admin')),
    pin_code TEXT NOT NULL, -- Hasheado com bcrypt
    active BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    category TEXT,
    supplier TEXT,
    note TEXT,
    minimum_quantity INTEGER NOT NULL DEFAULT 0,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supply_id UUID REFERENCES supplies(id),
    user_id UUID REFERENCES app_users(id),
    destination_id UUID REFERENCES destinations(id),
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
