✅ SUPABASE + RENDER - CHECKLIST COMPLETO
═══════════════════════════════════════════════════════════════════════════════

Antes de usar online, verifique tudo.

═══════════════════════════════════════════════════════════════════════════════

📋 SUPABASE - SETUP
─────────────────────────────────────────────────────────────────────────────

Conta Supabase:
  ☐ Criada em https://supabase.com
  ☐ Email confirmado
  ☐ Primeiro login feito

Projeto Supabase:
  ☐ Projeto criado: "stockflow"
  ☐ Região: São Paulo (ou sua região)
  ☐ Password copiada com segurança
  ☐ Projeto mostra: "Your project is ready"

Connection String:
  ☐ DATABASE_URL copiada da seção "Database"
  ☐ Tipo "URI" copiado
  ☐ Formato: postgresql://postgres:[PASS]@db.[ID].supabase.co:5432/postgres
  ☐ Guardada com segurança


═══════════════════════════════════════════════════════════════════════════════

📝 DATABASE SCHEMA
─────────────────────────────────────────────────────────────────────────────

Schema.sql:
  ☐ Arquivo db/schema.sql existe
  ☐ Conteúdo copiado integralmente
  ☐ Colado no SQL Editor do Supabase
  ☐ Query rodou sem erros: "Query executed successfully"
  ☐ Tabelas criadas (pode ver em Table Editor)

Seed.sql:
  ☐ Arquivo db/seed.sql existe
  ☐ Conteúdo copiado integralmente
  ☐ Colado em novo Query do Supabase
  ☐ Query rodou sem erros
  ☐ Dados inseridos (usuários, destinos, etc)

Verificação:
  ☐ Abrir Table Editor no Supabase
  ☐ Ver tabelas: app_users, destinations, supplies, etc
  ☐ Ver dados: Administrador, Luiz, Henrique, etc


═══════════════════════════════════════════════════════════════════════════════

💻 ARQUIVO .env LOCAL
─────────────────────────────────────────────────────────────────────────────

.env existe?
  ☐ Arquivo .env na raiz do projeto

DATABASE_URL atualizado?
  ☐ Antigo: postgres://postgres:postgres@localhost:5432/stockflow
  ☐ Novo: postgresql://postgres:[PASS]@db.[ID].supabase.co:5432/postgres
  ☐ Com sua senha REAL do Supabase

Segurança:
  ☐ .env NÃO foi commitado (está no .gitignore)
  ☐ .env.example continua com placeholders
  ☐ Seu .env local tem DATABASE_URL do Supabase


═══════════════════════════════════════════════════════════════════════════════

🧪 TESTE LOCAL
─────────────────────────────────────────────────────────────────────────────

Tudo pronto?
  ☐ Projeto local está funcionando
  ☐ npm start executado sem erros
  ☐ Server rodando em http://localhost:4173

Conexão com Supabase:
  ☐ Abrir http://localhost:4173
  ☐ Fazer login: Administrador / 0000
  ☐ Dashboard carrega
  ☐ Dados aparecem (métrica de itens, etc)
  ☐ Consegue fazer uma retirada
  ☐ Logout e login novamente: dados persistem no Supabase

Sem erros?
  ☐ Console não mostra erros de conexão
  ☐ Nenhuma mensagem vermelha
  ☐ Tudo funcionando normalmente


═══════════════════════════════════════════════════════════════════════════════

🐙 GIT & GITHUB
─────────────────────────────────────────────────────────────────────────────

Código no GitHub?
  ☐ Repo existente: https://github.com/seu-usuario/stockflow
  ☐ Commits anteriores estão lá

Novo commit com Supabase:
  ☐ git add . (adicionar tudo)
  ☐ git commit -m "Setup: Using Supabase for database"
  ☐ git push origin master (enviar para GitHub)
  ☐ GitHub mostra novos arquivos

Verificar:
  ☐ Abrir GitHub
  ☐ Ver arquivo .env.example (sem senha)
  ☐ .env NÃO está no GitHub (está ignorado)
  ☐ Todos os guias estão no repositório


═══════════════════════════════════════════════════════════════════════════════

☁️ DEPLOY EM RENDER (OU RAILWAY)
─────────────────────────────────────────────────────────────────────────────

Conta Render:
  ☐ Criada em https://render.com
  ☐ Email confirmado
  ☐ GitHub conectado

Repositório conectado:
  ☐ Dashboard Render
  ☐ Repositório "stockflow" visível
  ☐ Branch "master" selecionado

Web Service criado:
  ☐ New → Web Service
  ☐ Repositório selecionado
  ☐ Build command: npm install
  ☐ Start command: npm start
  ☐ Web Service criado

Environment Variables:
  ☐ Ir em "Environment"
  ☐ Adicionar: DATABASE_URL = [SUA_URL_SUPABASE]
  ☐ Salvar (redeploy automático)

Deploy status:
  ☐ Render começou o deploy
  ☐ Logs mostram: "npm install"
  ☐ Logs mostram: "node server.js"
  ☐ Resultado: "✅ Your service is live!"
  ☐ URL gerada: seu-stockflow.onrender.com


═══════════════════════════════════════════════════════════════════════════════

🌐 TESTE ONLINE
─────────────────────────────────────────────────────────────────────────────

URL funciona?
  ☐ Abrir: https://seu-stockflow.onrender.com
  ☐ Página carrega (pode demorar 30 seg se em hibernação)

Fazer login:
  ☐ Usuário: Administrador
  ☐ PIN: 0000
  ☐ Login aceito

Dashboard online:
  ☐ Dashboard carrega
  ☐ Métricas aparecem
  ☐ Dados do Supabase aparecem

Funcionalidade:
  ☐ Consegue fazer retirada
  ☐ Dados são salvos
  ☐ Logout e login: dados persistem
  ☐ Nenhum erro na tela

Performance:
  ☐ Página carrega em tempo aceitável
  ☐ Cliques respondem normalmente
  ☐ Sem travamentos


═══════════════════════════════════════════════════════════════════════════════

📱 TESTE DE MÚLTIPLOS ACESSOS
─────────────────────────────────────────────────────────────────────────────

Acessar de múltiplos lugares:
  ☐ PC: https://seu-stockflow.onrender.com
  ☐ Celular: mesma URL
  ☐ Tablet: mesma URL
  ☐ Outro PC: mesma URL

Simultâneo:
  ☐ Abrir em 2 navegadores
  ☐ Fazer login em um
  ☐ Fazer login em outro
  ☐ Ambos conseguem acessar
  ☐ Dados sincronizam entre eles

Dados compartilhados:
  ☐ Uma retirada em um lugar
  ☐ Aparece no outro lugar
  ☐ Todos veem os mesmos dados
  ☐ Supabase sincroniza tudo


═══════════════════════════════════════════════════════════════════════════════

🔐 SEGURANÇA
─────────────────────────────────────────────────────────────────────────────

Credenciais:
  ☐ DATABASE_URL não está no Git (verificar .gitignore)
  ☐ Sem sen ha real no código-fonte
  ☐ Só em variáveis de ambiente

Render Environment:
  ☐ DATABASE_URL está em Environment (visível apenas para quem tem acesso)
  ☐ Não está em logs públicos
  ☐ Segura no dashboard

Supabase:
  ☐ Senha do banco guardada com segurança
  ☐ Não compartilhada publicamente
  ☐ URL do Supabase é pública (OK)

Login da App:
  ☐ PIN obrigatório (0000 para admin, 1111 para técnico)
  ☐ Trocar depois se for produção real
  ☐ Database URL só no servidor (não no frontend)


═══════════════════════════════════════════════════════════════════════════════

🆘 TROUBLESHOOTING
─────────────────────────────────────────────────────────────────────────────

Se "Erro ao conectar no banco" online:
  ☐ Verificar DATABASE_URL em Render Environment
  ☐ Verificar se copiou inteiro (sem espaços)
  ☐ Ver logs no Render: "Logs" tab
  ☐ Procurar mensagem de erro específica

Se "Página não carrega":
  ☐ Esperar 30 segundos (primeira vez ou hibernação)
  ☐ Recarregar página (F5)
  ☐ Limpar cache (Ctrl+Shift+Delete)
  ☐ Ver status do Render Deploy

Se "Login não funciona":
  ☐ Verificar PIN: 0000 (admin) ou 1111 (técnico)
  ☐ Verificar usuários no Supabase Table Editor
  ☐ Ver if table app_users tem dados

Se "Dados não salvam":
  ☐ Ver logs no Render
  ☐ Ver se query chegou no banco
  ☐ Verificar permissões no Supabase


═══════════════════════════════════════════════════════════════════════════════

✅ CHECKLIST FINAL ANTES DE COMPARTILHAR
─────────────────────────────────────────────────────────────────────────────

Tudo funcionando?
  ☐ Local: npm start → login → funciona
  ☐ Online: seu-stockflow.onrender.com → login → funciona
  ☐ Dados: mesmos em local e online (Supabase)
  ☐ Múltiplos acessos: 2+ pessoas conseguem usar

Segurança OK?
  ☐ Sem credenciais expostas
  ☐ .env local não foi commitado
  ☐ DATABASE_URL segura em Render Environment
  ☐ PIN obrigatório para login

Documentação?
  ☐ README.md aponta para guias
  ☐ Guias estão no repositório
  ☐ Instruções claras em português
  ☐ Checklists disponíveis

Pronto para compartilhar?
  ☐ Sim! Tudo checado ✅
  ☐ Compartilhe URL: seu-stockflow.onrender.com
  ☐ Compartilhe credenciais de login
  ☐ Aponte para SUPABASE-PASSO-A-PASSO.md se precisarem setup local


═══════════════════════════════════════════════════════════════════════════════

🎉 QUANDO TUDO PASSAR NO CHECKLIST

Seu StockFlow está:
  ✅ Com Supabase (banco na nuvem)
  ✅ Com Render (aplicação rodando)
  ✅ 100% ONLINE
  ✅ Acessível de qualquer lugar
  ✅ Pronto para usar com equipe

URL para compartilhar:
  seu-stockflow.onrender.com

Login:
  Administrador / 0000

Pronto para produção! 🚀

═══════════════════════════════════════════════════════════════════════════════
