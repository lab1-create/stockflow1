✅ CHECKLIST - PRONTO PARA DEPLOY ONLINE
═══════════════════════════════════════════════════════════════════════════════

Antes de colocar online, verifique tudo:

═══════════════════════════════════════════════════════════════════════════════

📋 VERIFICAÇÃO LOCAL
─────────────────────────────────────────────────────────────────────────────

Seu Computador:
  ☐ Docker Desktop instalado
  ☐ Projeto funciona localmente (STARTUP.bat)
  ☐ http://localhost:4173 abre sem erros
  ☐ Login funciona (Administrador / 0000)
  ☐ Consegue fazer retirada

Arquivos:
  ☐ Arquivo .env existe
  ☐ Arquivo .env.example existe
  ☐ Arquivo render.yaml existe
  ☐ Arquivo docker-compose.yml existe
  ☐ package.json completo
  ☐ server.js existe


═══════════════════════════════════════════════════════════════════════════════

📦 VERIFICAÇÃO GIT
─────────────────────────────────────────────────────────────────────────────

Você tem Git instalado?
  ☐ Executar: git --version
  ☐ Deve mostrar versão

Você tem GitHub?
  ☐ Criar conta em: https://github.com
  ☐ Email confirmado
  ☐ SSH key configurada (opcional)


═══════════════════════════════════════════════════════════════════════════════

🔐 VERIFICAÇÃO DE SEGURANÇA
─────────────────────────────────────────────────────────────────────────────

Arquivo .env:
  ☐ Não deve ser compartilhado
  ☐ Está no .gitignore
  ☐ Contém DATABASE_URL correto

Arquivo .env.example:
  ☐ Existe (sem dados reais)
  ☐ Com placeholders/exemplos
  ☐ Seguro compartilhar

Credenciais:
  ☐ Nenhuma credencial hardcoded
  ☐ PIN padrão só é para teste
  ☐ Trocar depois se produção real


═══════════════════════════════════════════════════════════════════════════════

📝 VERIFICAÇÃO DE ARQUIVOS
─────────────────────────────────────────────────────────────────────────────

Principais:
  ☐ app.js (frontend)
  ☐ dashboard.js (frontend)
  ☐ server.js (backend) ⭐
  ☐ index.html (HTML)
  ☐ styles.css (CSS)

Configuração:
  ☐ package.json
  ☐ package-lock.json
  ☐ render.yaml ⭐ (Importante!)
  ☐ docker-compose.yml

Database:
  ☐ db/schema.sql
  ☐ db/seed.sql
  ☐ db/clear-data.sql

Scripts:
  ☐ scripts/run-sql.js
  ☐ scripts/launcher.js

Documentação:
  ☐ README.md
  ☐ SETUP-LOCAL.md
  ☐ DEPLOY-ONLINE.md
  ☐ RENDER-PASSO-A-PASSO.md


═══════════════════════════════════════════════════════════════════════════════

🌐 VERIFICAÇÃO DO GITHUB
─────────────────────────────────────────────────────────────────────────────

Você tem repositório no GitHub?
  ☐ Acessar: https://github.com/novo
  ☐ Criar repositório "stockflow"
  ☐ Copiar URL: https://github.com/seu-usuario/stockflow.git

Projeto foi enviado?
  ☐ Executar: git remote add origin [URL]
  ☐ Executar: git push -u origin main
  ☐ Verificar no GitHub se arquivos estão lá


═══════════════════════════════════════════════════════════════════════════════

☁️  VERIFICAÇÃO RENDER
─────────────────────────────────────────────────────────────────────────────

Você tem conta Render?
  ☐ Acessar: https://render.com
  ☐ Criar conta (grátis)
  ☐ Confirmar email

GitHub conectado no Render?
  ☐ Dashboard → Settings
  ☐ Conectar GitHub
  ☐ Autorizar Render acessar sua conta

Repositório visível?
  ☐ Dashboard Render
  ☐ Procurar repositório "stockflow"
  ☐ Selecionar ele


═══════════════════════════════════════════════════════════════════════════════

🚀 ANTES DE FAZER DEPLOY
─────────────────────────────────────────────────────────────────────────────

Arquivo render.yaml:
  ☐ Existe na raiz do projeto
  ☐ Tem sintaxe YAML correta
  ☐ Define Web Service e Database
  ☐ Define comando "npm run deploy:start"

Environment Variables:
  ☐ DATABASE_URL vai ser criado automaticamente
  ☐ APP_ACCESS_KEY vai ser criado automaticamente
  ☐ PORT é 4173 (padrão)

Scripts npm:
  ☐ npm start ......................... Executa: node server.js
  ☐ npm run deploy:start .............. Executa: npm run db:init && node server.js
  ☐ npm run db:init ................... Cria schema + seed


═══════════════════════════════════════════════════════════════════════════════

✅ CHECKLIST DE DEPLOY
─────────────────────────────────────────────────────────────────────────────

Projeto pronto?
  ☐ Todas verificações acima passaram
  ☐ Nenhuma mensagem de erro
  ☐ Tudo testado localmente

Pronto para upload?
  ☐ git status (sem mudanças pendentes)
  ☐ git push (todos arquivos no GitHub)
  ☐ Verificar em GitHub se tudo está lá

Render configurado?
  ☐ Conta criada
  ☐ GitHub conectado
  ☐ Repositório selecionado

Pronto para fazer deploy?
  ☐ Dashboard Render → "New +" → "Blueprint"
  ☐ Selecionar repositório
  ☐ Clicar "Create from Blueprint"
  ☐ Aguardar 5 minutos


═══════════════════════════════════════════════════════════════════════════════

🔍 DURANTE O DEPLOY
─────────────────────────────────────────────────────────────────────────────

Render está fazendo:
  ⏳ Fazer deploy
  ⏳ Instalar dependências (npm install)
  ⏳ Criar banco de dados
  ⏳ Rodar schema.sql
  ⏳ Rodar seed.sql
  ⏳ Iniciar servidor
  ⏳ Gerar URL

Você verá:
  ✅ Building...
  ✅ Deploying...
  ✅ Your service is live!

Tempo: 3-5 minutos


═══════════════════════════════════════════════════════════════════════════════

✨ DEPOIS DO DEPLOY
─────────────────────────────────────────────────────────────────────────────

URL gerada:
  ☐ Render mostra: https://seu-stockflow-xxxxx.onrender.com
  ☐ Copiar URL completa

Teste online:
  ☐ Abrir URL no navegador
  ☐ Pedir APP_ACCESS_KEY (Environment Render)
  ☐ Colar chave
  ☐ Fazer login
  ☐ Verificar se dados estão lá

Compartilhar:
  ☐ Copiar URL final
  ☐ Enviar para equipe
  ☐ Compartilhar APP_ACCESS_KEY
  ☐ Instruções: "Acesse a URL, cole a chave, login com Administrador/0000"


═══════════════════════════════════════════════════════════════════════════════

🧪 TESTES FINAIS
─────────────────────────────────────────────────────────────────────────────

Funcionalidade:
  ☐ Login funciona
  ☐ Dashboard carrega
  ☐ Consegue fazer retirada
  ☐ Dados são salvos
  ☐ Logout e login novamente: dados persistem
  ☐ Acesso do celular funciona
  ☐ Acesso de outro PC funciona

Performance:
  ☐ Página carrega em tempo aceitável
  ☐ Sem mensagens de erro no console
  ☐ Responde aos cliques normalmente

Segurança:
  ☐ APP_ACCESS_KEY é obrigatória
  ☐ PIN obrigatório no login
  ☐ Sem dados sensíveis expostos
  ☐ HTTPS funciona (cadeado no navegador)


═════════════════════════════════════════════════════════════════════════════

📋 SE ALGUMA COISA NÃO PASSOU
─────────────────────────────────────────────────────────────────────────────

❌ Arquivo render.yaml não existe?
   → Não está pronto para Render
   → Verificar se projeto é o correto

❌ GitHub não conectado?
   → Ir em Render Settings
   → Conectar GitHub
   → Autorizar

❌ Deploy falhou?
   → Clicar no serviço no Render
   → Aba "Logs"
   → Ver qual é o erro
   → Corrigir no GitHub
   → Fazer novo push
   → Render faz redeploy automático

❌ Acesso recusado?
   → Verificar APP_ACCESS_KEY
   → Verificar se copiou inteiro
   → Sem espaços extras

❌ Banco não conecta?
   → Render vai criar automaticamente
   → Pode levar alguns minutos
   → Aguarde e recarregue


═════════════════════════════════════════════════════════════════════════════

🎉 QUANDO TUDO PASSAR
─────────────────────────────────════════════════════════════════════════════

✅ Seu StockFlow está ONLINE!

URL: https://seu-stockflow-xxxxx.onrender.com

Você conseguiu:
  ✅ Preparar projeto local
  ✅ Enviar para GitHub
  ✅ Fazer deploy automático
  ✅ Acessar online
  ✅ Compartilhar com equipe

Próximos passos:
  1. Usar normalmente
  2. Monitorar em Render Dashboard
  3. Fazer upgrades se necessário
  4. Trocar PIN se produção real
  5. Adicionar mais usuários


═════════════════════════════════════════════════════════════════════════════

                    🎊 PARABÉNS! ESTÁ TUDO PRONTO! 🎊

═════════════════════════════════════════════════════════════════════════════
