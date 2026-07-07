🚀 SUPABASE - PASSO-A-PASSO (Guia Visual)
═══════════════════════════════════════════════════════════════════════════════

Vamos colocar o banco do StockFlow no Supabase em 20 minutos.

═══════════════════════════════════════════════════════════════════════════════

PASSO 1: CRIAR CONTA SUPABASE
─────────────────────────────────────────────────────────────────────────────

1️⃣  Abrir: https://supabase.com

2️⃣  Clicar: "Start your project" ou "Sign up"

3️⃣  Escolher login:
    - GitHub (recomendado - usa conta GitHub)
    - Email

4️⃣  Se usar GitHub:
    - Clicar: "Continue with GitHub"
    - Autorizar Supabase
    - Pronto!

5️⃣  Se usar Email:
    - Email
    - Confirmar no seu inbox
    - Criar senha
    - Pronto!

✅ Conta criada


═══════════════════════════════════════════════════════════════════════════════

PASSO 2: CRIAR PROJETO NO SUPABASE
─────────────────────────────────────────────────────────────────────────────

1️⃣  Dashboard mostra: "New Project"

2️⃣  Clicar: "New Project" ou "Create a new project"

3️⃣  Preencher:

    ┌─────────────────────────────────────────┐
    │ Project name                            │
    │ [stockflow___________________]          │
    │                                         │
    │ Database password                       │
    │ [●●●●●●●●●] (gerar)                   │
    │                                         │
    │ Region                                  │
    │ [v] South America (São Paulo)          │
    │                                         │
    │ [Create new project]                   │
    └─────────────────────────────────────────┘

4️⃣  Clicar: "Create new project"

5️⃣  Aguardar 2-3 minutos... (Supabase cria o banco)

    Você verá: ⏳ Creating database...
    Depois:    ✅ Your project is ready!

✅ Projeto criado


═══════════════════════════════════════════════════════════════════════════════

PASSO 3: COPIAR DATABASE_URL
─────────────────────────────────────────────────────────────────────────────

Essa URL conecta sua aplicação ao banco Supabase.

1️⃣  No Dashboard Supabase:
    - Canto inferior esquerdo: "Project Settings"
    - Clicar nele

2️⃣  Abrir aba: "Database"

3️⃣  Procurar seção: "Connection string"

4️⃣  Tipo: Escolher "URI"

5️⃣  Você verá algo assim:

    ┌──────────────────────────────────────────────┐
    │ Connection string (URI)                     │
    │                                              │
    │ postgresql://postgres:[PASSWORD]@          │
    │ db.[PROJECT_ID].supabase.co:5432/postgres  │
    │                                              │
    │ [📋 Copy]                                    │
    └──────────────────────────────────────────────┘

6️⃣  Clicar: "Copy"

7️⃣  Colar em algum lugar seguro (Notepad, etc)

✅ DATABASE_URL copiada


═══════════════════════════════════════════════════════════════════════════════

PASSO 4: CRIAR TABELAS (SCHEMA)
─────────────────────────────────────────────────────────────────────────────

Vamos criar a estrutura do banco.

1️⃣  No Dashboard Supabase:
    - Aba esquerda: "SQL Editor"
    - Clicar nela

2️⃣  Botão: "+ New Query"

3️⃣  Editor abre, vazio

4️⃣  Abrir arquivo do seu projeto:
    - db/schema.sql

5️⃣  Copiar TODO o conteúdo do schema.sql

6️⃣  Colar no Editor do Supabase

7️⃣  Seu SQL fica assim:

    ┌────────────────────────────────────┐
    │ BEGIN;                             │
    │                                    │
    │ CREATE EXTENSION IF NOT EXISTS...  │
    │                                    │
    │ CREATE TABLE IF NOT EXISTS...      │
    │                                    │
    │ ... (muito código)                 │
    │                                    │
    │ COMMIT;                            │
    │                                    │
    │ [▶ Run]                            │
    └────────────────────────────────────┘

8️⃣  Clicar: "Run" (triângulo azul, lado direito)

9️⃣  Aguardar 5-10 segundos

🔟  Resultado:
    ✅ Query executed successfully!
    ✅ 0 rows affected

    (Ou com mais informações se tables forem grandes)

✅ Tabelas criadas!


═══════════════════════════════════════════════════════════════════════════════

PASSO 5: ADICIONAR DADOS INICIAIS (SEED)
─────────────────────────────────────────────────────────────────────────────

Vamos adicionar usuários e destinos padrão.

1️⃣  SQL Editor: "+ New Query"

2️⃣  Abrir arquivo:
    - db/seed.sql

3️⃣  Copiar TODO o conteúdo

4️⃣  Colar no novo Query do Supabase

5️⃣  Seu SQL fica assim:

    ┌────────────────────────────────────┐
    │ BEGIN;                             │
    │                                    │
    │ INSERT INTO app_users VALUES...   │
    │                                    │
    │ INSERT INTO destinations VALUES... │
    │                                    │
    │ ... (dados iniciais)               │
    │                                    │
    │ COMMIT;                            │
    │                                    │
    │ [▶ Run]                            │
    └────────────────────────────────────┘

6️⃣  Clicar: "Run"

7️⃣  Resultado:
    ✅ Query executed successfully!
    ✅ (X) rows affected

✅ Dados iniciais inseridos!

Você pode ver os dados:
  - Aba esquerda: "Table Editor"
  - Ver tabelas: app_users, destinations, etc


═══════════════════════════════════════════════════════════════════════════════

PASSO 6: ATUALIZAR ARQUIVO .env
─────────────────────────────────────────────────────────────────────────────

Agora conectaremos a aplicação ao Supabase.

1️⃣  Abrir arquivo: .env (na pasta do projeto)

2️⃣  Encontrar linha:
    DATABASE_URL=postgres://postgres:postgres@localhost:5432/stockflow

3️⃣  Trocar por (cole a URL do Supabase):
    DATABASE_URL=postgresql://postgres:[SENHA]@db.[PROJECT].supabase.co:5432/postgres

4️⃣  Exemplo real:
    DATABASE_URL=postgresql://postgres:abc123xyz@db.pqznuarc.supabase.co:5432/postgres

5️⃣  Salvar arquivo

✅ .env atualizado


═══════════════════════════════════════════════════════════════════════════════

PASSO 7: TESTAR LOCALMENTE
─────────────────────────────────────────────────────────────────────────────

Vamos testar se a aplicação conecta ao Supabase.

1️⃣  Abrir terminal na pasta do projeto

2️⃣  Executar:
    npm start

3️⃣  Aguardar... (pode levar alguns segundos na primeira vez)

4️⃣  Você verá:
    ✅ Servidor rodando em http://localhost:4173

5️⃣  Abrir navegador: http://localhost:4173

6️⃣  Fazer login:
    Usuário: Administrador
    PIN: 0000

7️⃣  Se aparecer Dashboard com dados:
    ✅ Conectou ao Supabase com sucesso!

✅ Aplicação funcionando com Supabase!


═══════════════════════════════════════════════════════════════════════════════

PASSO 8: FAZER GIT COMMIT
─────────────────────────────────────────────────────────────────────────────

Salvar mudanças no Git (sem o .env!)

1️⃣  Terminal:

    git add .
    git commit -m "Setup: Using Supabase for database"
    git push origin master

2️⃣  Pronto! GitHub atualizado


═══════════════════════════════════════════════════════════════════════════════

PASSO 9: DEPLOY EM RENDER/RAILWAY
─────────────────────────────────────────────────────────────────────────────

Agora falta só fazer deploy da APLICAÇÃO (não do banco, que já está no Supabase).

OPÇÃO A: RENDER
─────────────────────────────────────────────────────────────────────────────

1️⃣  https://dashboard.render.com

2️⃣  "New +" → "Web Service"

3️⃣  Conectar GitHub e selecionar repositório

4️⃣  Configurar:
    ┌────────────────────────────────────┐
    │ Name: stockflow                    │
    │ Root Directory: (deixar vazio)     │
    │ Build Command: npm install         │
    │ Start Command: npm start           │
    │ [Create Web Service]               │
    └────────────────────────────────────┘

5️⃣  Depois ir em "Environment":
    - Adicionar variável:
      ```
      DATABASE_URL=postgresql://...supabase.co...
      ```

6️⃣  Salvar

7️⃣  Render faz deploy

8️⃣  URL gerada: seu-stockflow.onrender.com


OPÇÃO B: RAILWAY
─────────────────────────────────────────────────────────────────────────────

1️⃣  https://railway.app

2️⃣  "New Project" → "Deploy from GitHub"

3️⃣  Selecionar repositório

4️⃣  Railway configura automaticamente

5️⃣  Adicionar variável de ambiente:
    DATABASE_URL=postgresql://...supabase.co...

6️⃣  Deploy automático

7️⃣  URL gerada


═══════════════════════════════════════════════════════════════════════════════

PASSO 10: VERIFICAÇÃO FINAL
─────────────────────────────────────────────────────────────────────────────

Tudo pronto? Verifica:

✅ Supabase projeto criado
✅ Schema.sql rodado
✅ Seed.sql rodado
✅ .env local com DATABASE_URL
✅ npm start funciona
✅ Login funciona
✅ Dados aparecem
✅ Commit no GitHub
✅ Deploy em Render/Railway
✅ URL online funciona
✅ Login online funciona
✅ Dados online aparecem

Tudo ✅? PARABÉNS! 🎉


═══════════════════════════════════════════════════════════════════════════════

🎯 RESULTADO FINAL
────────────────────────────────────────────────────────────────────────────

Supabase:   ✅ Banco PostgreSQL na nuvem
URL Render: ✅ Aplicação rodando online
Conectadas: ✅ Via DATABASE_URL

Seu StockFlow está 100% ONLINE!


═══════════════════════════════════════════════════════════════════════════════

📱 ACESSAR ONLINE
────────────────────────────────────────────────────────────────────────────

URL: seu-stockflow.onrender.com (ou railway)

Fazer login:
  Usuário: Administrador
  PIN: 0000

Usar normalmente em:
  ✓ PC
  ✓ Celular
  ✓ Tablet
  ✓ De qualquer lugar


═══════════════════════════════════════════════════════════════════════════════

🎊 PRONTO! StockFlow com Supabase + Render ONLINE! 🎊

═══════════════════════════════════════════════════════════════════════════════
