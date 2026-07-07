# 🚀 Configuração Local do StockFlow

## Pré-requisitos

- **Node.js 20.x** (https://nodejs.org)
- **Docker & Docker Compose** (https://www.docker.com)
- **PostgreSQL 16** (Integrado no Docker, ou instale localmente)

## Opção 1: Com Docker Compose (Recomendado)

### 1️⃣ Clonar/Copiar o Projeto

```bash
git clone <seu-repositorio>
cd stockflow-main
```

### 2️⃣ Verificar o Arquivo `.env`

O arquivo `.env` já existe com valores padrão. Se precisar alterar:

```env
DATABASE_URL=postgres://postgres:postgres@postgres:5432/stockflow
PORT=4173
HOST=0.0.0.0
```

### 3️⃣ Executar com Docker Compose

```bash
docker-compose up
```

Aguarde até ver: `Servidor rodando em http://0.0.0.0:4173`

### 4️⃣ Acessar a Aplicação

Abra no navegador: **http://localhost:4173**

### 5️⃣ Fazer Login

**Administrador:**
- Usuário: `Administrador`
- PIN: `0000`

**Técnicos:**
- Usuários: `Luiz`, `Henrique`, `Joao`, `Gabriel`
- PIN: `1111`

---

## Opção 2: Desenvolvimento Local (Sem Docker)

### 1️⃣ Instalar Dependências

```bash
npm install
```

### 2️⃣ Configurar PostgreSQL Local

**Windows (PowerShell):**
```bash
# Instalar PostgreSQL se não tiver
choco install postgresql

# Verificar se está rodando
psql -U postgres -c "SELECT version();"
```

**Criar banco de dados:**
```bash
psql -U postgres -c "CREATE DATABASE stockflow;"
```

### 3️⃣ Executar Scripts SQL

```bash
npm run db:init
```

Ou manualmente:
```bash
npm run db:schema
npm run db:seed
```

### 4️⃣ Iniciar o Servidor

```bash
npm start
```

Acesse: **http://localhost:4173**

---

## Opção 3: Usar Supabase (Cloud)

### 1️⃣ Criar Conta no Supabase

1. Acesse: https://supabase.com
2. Crie um novo projeto
3. Copie as credenciais

### 2️⃣ Atualizar `.env`

```env
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-aqui
```

### 3️⃣ Executar Schema

```bash
npm run db:init
```

### 4️⃣ Iniciar

```bash
npm start
```

---

## Troubleshooting

### ❌ "DATABASE_URL não configurada"

**Solução:**
```bash
# Verificar se .env existe
ls .env

# Se não existir, criar do exemplo
copy .env.example .env

# Editar e preencher os valores corretos
```

### ❌ "Erro ao conectar no banco"

```bash
# Verificar se PostgreSQL está rodando
docker ps  # Com Docker

psql -U postgres  # Local
```

### ❌ "Porta 4173 já em uso"

```bash
# Mudar a porta no .env
PORT=4174

# Ou matar o processo
netstat -ano | findstr :4173
taskkill /PID [PID] /F
```

### ❌ "Erro no Docker Compose"

```bash
# Remover containers e volumes
docker-compose down -v

# Reconstruir
docker-compose up --build
```

---

## Scripts Disponíveis

```bash
npm start              # Inicia o servidor
npm run dev            # Modo desenvolvimento
npm run db:init        # Cria schema + seed
npm run db:schema      # Apenas schema
npm run db:seed        # Apenas dados iniciais
npm run db:clear       # Limpa todos os dados
```

---

## ✅ Verificação Final

Se tudo funcionou:

1. ✅ Servidor rodando em `http://localhost:4173`
2. ✅ Consegue fazer login
3. ✅ Dashboard carrega com dados iniciais
4. ✅ Pode criar retiradas/devoluções

**Pronto para usar!** 🎉
