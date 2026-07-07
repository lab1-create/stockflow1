🌐 DEPLOY ONLINE - STOCKFLOW NA NUVEM
═════════════════════════════════════════════════════════════════════════════

Seu projeto será acessível por uma URL como:
  https://seu-stockflow.onrender.com

Qualquer pessoa com a URL consegue acessar de qualquer lugar.

═════════════════════════════════════════════════════════════════════════════

⚡ OPÇÃO 1: RENDER (Recomendado - Mais Fácil)
═════════════════════════════════════════════════════════════════════════════

Vantagens:
  ✅ Grátis (com limitações)
  ✅ Sem configuração complexa
  ✅ Banco PostgreSQL incluído
  ✅ Deploy automático do GitHub
  ✅ render.yaml já existe no projeto

Tempo: 10 minutos

PASSO 1: Enviar para GitHub
─────────────────────────────────────────────────────────────────────────────

1. Criar repositório no GitHub:
   https://github.com/new

2. Nome: stockflow

3. Privado ou Público (você decide)

4. Copiar os comandos:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - StockFlow"
   git branch -M main
   git remote add origin https://github.com/SEUUSUARIO/stockflow.git
   git push -u origin main
   ```

5. Pronto no GitHub!


PASSO 2: Deploy no Render
─────────────────────────────────────────────────────────────────────────────

1. Acessar: https://dashboard.render.com

2. Clicar em: "New +" → "Blueprint"

3. Conectar repositório GitHub do StockFlow

4. Selecionar: main branch

5. Clicar em: "Create from Blueprint"

6. Render vai:
   ✅ Criar Node.js Web Service
   ✅ Criar PostgreSQL database
   ✅ Configurar automaticamente
   ✅ Fazer deploy

7. Esperar 3-5 minutos...

8. Ver URL: https://seu-stockflow.onrender.com


PASSO 3: Acessar Online
─────────────────────────────────────────────────────────────────────────────

1. Abrir: https://seu-stockflow.onrender.com

2. Primeira vez vai pedir APP_ACCESS_KEY

3. Isso é SEGURANÇA - não deixa qualquer um entrar

4. Depois: Login normal
   Usuário: Administrador
   PIN: 0000


PASSO 4: Mudança de APP_ACCESS_KEY (Opcional)
─────────────────────────────────────────────────────────────────────────────

Se quiser trocar a chave de acesso:

1. No Dashboard do Render
2. Abrir serviço "stockflow"
3. Ir em "Environment"
4. Procurar "APP_ACCESS_KEY"
5. Copiar a chave ou gerar nova
6. Compartilhar com sua equipe
7. Salvar (vai fazer redeploy)


═════════════════════════════════════════════════════════════════════════════

⚡ OPÇÃO 2: RAILWAY (Também Fácil)
═════════════════════════════════════════════════════════════════════════════

1. Acessar: https://railway.app

2. Conectar GitHub

3. Selecionar repositório stockflow

4. Railway configura tudo automaticamente

5. URL: seu-stockflow.railway.app

6. Pronto!

Vantagem: Ainda mais simples que Render


═════════════════════════════════════════════════════════════════════════════

⚡ OPÇÃO 3: VERCEL (Mais Moderna)
═════════════════════════════════════════════════════════════════════════════

1. Acessar: https://vercel.com

2. Conectar GitHub

3. Selecionar repositório stockflow

4. Configurar:
   - Framework: Other
   - Build: npm run build (ou deixar vazio)
   - Output: ./

5. Deploy

6. URL: seu-stockflow.vercel.app

Nota: Vercel é melhor para frontend, menos para backend com banco


═════════════════════════════════════════════════════════════════════════════

🎯 RECOMENDAÇÃO: Use RENDER
═════════════════════════════════════════════════════════════════════════════

Porque:
  ✅ render.yaml já está configurado
  ✅ Suporta bem Node.js + PostgreSQL
  ✅ Grátis e confiável
  ✅ Deploy automático do GitHub

Próximos Passos:

1. Ter repositório no GitHub (se não tiver)
2. Acessar https://dashboard.render.com
3. Clicar "New" → "Blueprint"
4. Conectar seu repositório
5. Confirmar deploy
6. Aguardar 3-5 minutos
7. Usar a URL gerada

═════════════════════════════════════════════════════════════════════════════

🔐 IMPORTANTE: APP_ACCESS_KEY
═════════════════════════════════════════════════════════════════════════════

Toda vez que abrir a URL, a plataforma pede uma chave.

Encontrar:
1. Dashboard Render
2. Servico "stockflow"
3. "Environment"
4. Procurar "APP_ACCESS_KEY"
5. Copiar valor (exemplo: abc123def456)

Compartilhar:
1. Enviar para sua equipe
2. Ela coloca no campo
3. Pronto! Acessa

Mudar a Chave:
1. Editar valor em Environment
2. Salvar
3. Render faz redeploy
4. Compartilhar nova chave


═════════════════════════════════════════════════════════════════════════════

📱 ACESSAR DO CELULAR
═════════════════════════════════════════════════════════════════════════════

1. Abrir navegador do celular
2. Digitar: https://seu-stockflow.onrender.com
3. Colocar APP_ACCESS_KEY
4. Login: Administrador / 0000
5. Usar normalmente

Funciona em qualquer lugar com internet!


═════════════════════════════════════════════════════════════════════════════

💡 DICAS
═════════════════════════════════════════════════════════════════════════════

✓ Primeira vez do deploy demora 5 minutos
✓ Serviço pode "hibernar" se não usar (no plano grátis)
✓ Acordar é automático ao acessar
✓ Se precisar de mais performance, pagar upgrade
✓ Dados ficam persistidos no banco PostgreSQL
✓ Não perde dados mesmo desligando


═════════════════════════════════════════════════════════════════════════════

🚨 SEGURANÇA ONLINE
═════════════════════════════════════════════════════════════════════════════

Boas práticas:
  ✓ APP_ACCESS_KEY é obrigatória
  ✓ Não compartilhe senha publicamente
  ✓ Use HTTPS (já vem automático)
  ✓ Trocar PIN padrão depois
  ✓ Considerar 2FA se preciso

Se tiver muitos usuários:
  → Criar sistema de login com username/senha
  → Criptografar dados sensíveis
  → Adicionar auditoria de acesso


═════════════════════════════════════════════════════════════════════════════

📊 COMPARAÇÃO: LOCAL vs ONLINE
═════════════════════════════════════════════════════════════════════════════

LOCAL (Seu PC):
  ✓ Rápido
  ✓ Sem custo
  ✗ Só acessa localmente
  ✗ Depende do seu PC ligado
  ✗ Só sua rede

ONLINE (Render):
  ✓ Acessível de qualquer lugar
  ✓ Funciona 24/7
  ✓ Escala automaticamente
  ✓ Backup automático
  ✗ Pode ser mais lento
  ✗ Precisa estar online
  ✗ Limite de requests (plano grátis)


═════════════════════════════════════════════════════════════════════════════

✅ PRÓXIMOS PASSOS
═════════════════════════════════════════════════════════════════════════════

1. Enviar projeto para GitHub (se não fez ainda)
2. Acessar https://dashboard.render.com
3. Fazer login/criar conta
4. Clicar "New" → "Blueprint"
5. Conectar repositório
6. Confirmar deploy
7. Aguardar 3-5 minutos
8. Usar a URL gerada
9. Compartilhar com equipe

═════════════════════════════════════════════════════════════════════════════

Pronto para colocar ONLINE? 🚀

Comece pelo Render (opção mais fácil)

═════════════════════════════════════════════════════════════════════════════
