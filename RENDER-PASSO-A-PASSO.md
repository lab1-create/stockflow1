═══════════════════════════════════════════════════════════════════════════════
            ⚡ RENDER - DEPLOY EM 10 MINUTOS (Guia Visual)
═══════════════════════════════════════════════════════════════════════════════

Vamos colocar seu StockFlow ONLINE usando Render.

URL Final: https://seu-stockflow.onrender.com

═══════════════════════════════════════════════════════════════════════════════

✅ PRÉ-REQUISITOS

Você precisa ter:
  ✅ Conta GitHub (grátis em https://github.com)
  ✅ Projeto no GitHub (vamos fazer agora)
  ✅ Conta Render (grátis em https://render.com)

═══════════════════════════════════════════════════════════════════════════════

PASSO 1: PREPARAR PROJETO LOCAL
────────────────────────────────────────────────────────────────────────────

Se já fez anteriormente, PULE ESTA SEÇÃO

Abra terminal na pasta do projeto:

┌──────────────────────────────────────────────────────────────────┐
│  Executar estes comandos:                                        │
├──────────────────────────────────────────────────────────────────┤
│  git init                                                        │
│  git add .                                                       │
│  git commit -m "Initial commit - StockFlow"                     │
│  git branch -M main                                             │
└──────────────────────────────────────────────────────────────────┘

✅ Projeto está pronto localmente


═══════════════════════════════════════════════════════════════════════════════

PASSO 2: CRIAR REPOSITÓRIO NO GITHUB
────────────────────────────────────────────────────────────────────────────

1️⃣  Abrir: https://github.com/new

2️⃣  Preencher:
    ┌─────────────────────────────────────┐
    │ Repository name: stockflow          │
    │ Description: Sistema de insumos     │
    │ Public (ou Private)                 │
    └─────────────────────────────────────┘

3️⃣  Clique: "Create repository"

4️⃣  GitHub vai mostrar comandos
    ┌─────────────────────────────────────────────────────────────┐
    │ git remote add origin                                       │
    │   https://github.com/SEUUSUARIO/stockflow.git              │
    │                                                             │
    │ git push -u origin main                                    │
    └─────────────────────────────────────────────────────────────┘

5️⃣  Copie e execute no terminal:
    ┌─────────────────────────────────────────────────────────────┐
    │ $ git remote add origin                                    │
    │   https://github.com/SEUUSUARIO/stockflow.git              │
    │                                                             │
    │ $ git push -u origin main                                  │
    │ (vai pedir username/password do GitHub)                   │
    └─────────────────────────────────────────────────────────────┘

6️⃣  Pronto! Projeto está no GitHub

✅ Projeto no GitHub


═════════════════════════════════════════════════════════════════════════════

PASSO 3: CONECTAR RENDER COM GITHUB
────────────────────────────────────────────────────────────────────────────

1️⃣  Abrir: https://dashboard.render.com

2️⃣  Se não tem conta, criar (é grátis)
    - Clicar: Sign up
    - Usar email
    - Confirmar email
    - Pronto!

3️⃣  No Dashboard, clicar: "New +" (lado esquerdo superior)

4️⃣  Selecionar: "Blueprint"

        ┌─────────────────────────────────────┐
        │  📋 What type of service?           │
        │  ┌─────────────────────────────────┐│
        │  │ ○ Web Service                  ││
        │  │ ○ Static Site                  ││
        │  │ ● Blueprint                    ││
        │  │ ○ Private Service              ││
        │  └─────────────────────────────────┘│
        │  [Create from Blueprint]           │
        └─────────────────────────────────────┘

5️⃣  Conectar GitHub:
    - Clicar: "Connect account"
    - Autorizar Render acessar GitHub
    - Pronto!

6️⃣  Selecionar repositório: "stockflow"

7️⃣  Render vai reconhecer render.yaml automaticamente

✅ Conectado com GitHub


═════════════════════════════════════════════════════════════════════════════

PASSO 4: CONFIGURAR E FAZER DEPLOY
────────────────────────────────────────────────────────────────────────────

1️⃣  Render vai mostrar a configuração:

        ┌──────────────────────────────────────────┐
        │ Blueprint: stockflow                     │
        │ Branch: main                             │
        │ Region: Ohio (padrão ok)                 │
        │                                          │
        │ [Create from Blueprint]                 │
        └──────────────────────────────────────────┘

2️⃣  Clicar: "Create from Blueprint"

3️⃣  Render vai:
    ✅ Criar Web Service Node.js
    ✅ Criar PostgreSQL Database
    ✅ Configurar automaticamente
    ✅ Fazer deploy

4️⃣  Você verá logs assim:

        ┌────────────────────────────────────┐
        │ ⏳ Building...                      │
        │                                    │
        │ ⏳ Deploying...                     │
        │                                    │
        │ ✅ Your service is live!          │
        │                                    │
        │ URL: https://seu-stockflow...    │
        └────────────────────────────────────┘

5️⃣  Esperar 3-5 minutos até aparecer "✅ Live"

✅ Deploy Concluído!


═════════════════════════════════════════════════════════════════════════════

PASSO 5: ACESSAR ONLINE
────────────────────────────────────────────────────────────────────────────

1️⃣  Render vai gerar URL:
        https://seu-stockflow.onrender.com

2️⃣  Copiar e abrir no navegador

3️⃣  Primeira vez vai pedir:
        ┌────────────────────────────────────┐
        │ 🔐 Access Key                       │
        │                                    │
        │ [_____________________]            │
        │                                    │
        │ [Authorize]                        │
        └────────────────────────────────────┘

4️⃣  Pegar Access Key:
    - Dashboard Render
    - Abrir serviço "stockflow"
    - Ir em "Environment"
    - Copiar "APP_ACCESS_KEY"

5️⃣  Colar no campo

6️⃣  Clicar "Authorize"

7️⃣  Ir para login:
        Usuário: Administrador
        PIN: 0000

8️⃣  ✅ StockFlow está ONLINE!


═════════════════════════════════════════════════════════════════════════════

🎯 VERIFICAÇÃO FINAL
────────────────────────────────────────────────────────────────────────────

✅ Consegue acessar a URL?
   → https://seu-stockflow.onrender.com

✅ Consegue fazer login?
   → Administrador / 0000

✅ Dashboard carrega?
   → Deve mostrar dados/métricas

✅ Consegue criar retirada?
   → Testar uma retirada

✅ Dados persistem?
   → Fazer logout e login novamente
   → Dados devem estar lá

Se tudo passou:

        🎉 PARABÉNS! StockFlow ONLINE! 🎉

        URL: https://seu-stockflow.onrender.com
        Compartilhe com seu time!


═════════════════════════════════════════════════════════════════════════════

📱 ACESSAR DO CELULAR/TABLET
────────────────────────────────────────────────────────────────────────────

1️⃣  Abrir navegador (Chrome, Safari, etc)

2️⃣  Digitar URL completa:
        https://seu-stockflow.onrender.com

3️⃣  Colocar APP_ACCESS_KEY

4️⃣  Fazer login

5️⃣  Usar normalmente!

Funciona em qualquer dispositivo com internet


═════════════════════════════════════════════════════════════════════════════

👥 COMPARTILHAR COM EQUIPE
────────────────────────────────────────────────────────────────────────────

Enviar para seus colegas:

Componha um email/mensagem assim:

    ┌─────────────────────────────────────────────────┐
    │ Olá! Aqui é a URL do StockFlow:                 │
    │                                                 │
    │ https://seu-stockflow.onrender.com             │
    │                                                 │
    │ Para acessar:                                   │
    │ 1. Abra a URL                                   │
    │ 2. Cole a chave: [COLE_AQUI]                   │
    │ 3. Clicar "Authorize"                           │
    │ 4. Login: Administrador, PIN: 0000             │
    │                                                 │
    │ Pronto! Pode usar!                              │
    │                                                 │
    │ Funciona em PC, celular, tablet                │
    │ De qualquer lugar com internet                  │
    └─────────────────────────────────────────────────┘

Onde pegar o APP_ACCESS_KEY:
    1. Dashboard Render
    2. Serviço "stockflow"
    3. Aba "Environment"
    4. Procurar "APP_ACCESS_KEY"
    5. Copiar o valor


═════════════════════════════════════════════════════════════════════════════

⚙️  GERENCIAR ONLINE
────────────────────────────────────────────────────────────────────────────

No Dashboard Render você consegue:

    ✓ Ver logs (Debug)
    ✓ Parar/reiniciar serviço
    ✓ Alterar variáveis de ambiente
    ✓ Ver uso de recursos (CPU, memória)
    ✓ Configurar alerts
    ✓ Upgrade para melhor performance

Tudo no: https://dashboard.render.com


═════════════════════════════════════════════════════════════════════════════

💡 DICAS IMPORTANTES
════════════════════════════════════════════════════════════════════════════

✓ Primeira vez demora 5 minutos (normal)
✓ Hibernação em plano grátis (acorda sozinho)
✓ Dados são persistidos sempre
✓ Redeploy automático quando faz push no GitHub
✓ Não perde banco de dados se desligar serviço
✓ APPs conectados funcionam simultaneamente


═════════════════════════════════════════════════════════════════════════════

🆘 TROUBLESHOOTING
════════════════════════════════════════════════════════════════════════════

❌ "Site não carrega"
   → Espere 5 minutos (deploy em progresso)
   → Recarregue página (F5)
   → Veja logs no Render

❌ "APP_ACCESS_KEY inválida"
   → Copie exatamente de Environment
   → Sem espaços antes/depois
   → Tente novamente

❌ "Erro de banco de dados"
   → Vá em Render Dashboard
   → Check "Logs"
   → Ver qual é o erro específico
   → Possivelmente schema não rodou

❌ "Porta já em uso"
   → Render gerencia isso automaticamente
   → Não precisa fazer nada

❌ "Ainda não funciona"
   → Veja logs no Render
   → Procure erros
   → Verifique se .env está correto
   → Recrie blueprint


═════════════════════════════════════════════════════════════════════════════

🎉 PRONTO! Seu StockFlow está ONLINE!

URL: https://seu-stockflow.onrender.com

Compartilhe com sua equipe e comece a usar!

═════════════════════════════════════════════════════════════════════════════
