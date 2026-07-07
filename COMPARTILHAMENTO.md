# 📤 Guia: Compartilhando o StockFlow com Outros Usuários

## ⚠️ Importante: Segurança Primeiro!

Antes de compartilhar, certifique-se de:

### ❌ NÃO Compartilhe:
- ❌ Arquivo `.env` (contém senhas e credenciais)
- ❌ Credenciais do Supabase no código
- ❌ Arquivo `node_modules` ou build files
- ❌ Logs privados

### ✅ SIM Compartilhe:
- ✅ Arquivo `.env.example` (com valores de exemplo)
- ✅ Código-fonte
- ✅ Documentação
- ✅ `docker-compose.yml`
- ✅ Arquivo `SETUP-LOCAL.md`

---

## 🔄 Passo 1: Preparar o Projeto para Compartilhamento

### No seu computador:

```bash
# 1. Remover credenciais do código
git rm --cached .env  # Remove do Git, mas mantém local

# 2. Certificar que .gitignore contém .env
# (Já está configurado no projeto)

# 3. Criar .env.example com valores seguros
# (Já foi criado)

# 4. Limpar node_modules e cache
rm -r node_modules
npm cache clean --force
```

---

## 📦 Passo 2: Compartilhar (Escolha uma opção)

### Opção A: GitHub/GitLab (Recomendado)

```bash
# 1. Criar repositório
git init
git add .
git commit -m "Initial commit - StockFlow"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/stockflow.git
git push -u origin main

# 2. Compartilhar URL
https://github.com/SEU_USUARIO/stockflow
```

### Opção B: ZIP (Sem versionamento)

```bash
# 1. Criar arquivo ZIP
# No Windows Explorer:
# - Clique direito na pasta stockflow-main
# - "Enviar para" > "Pasta compactada"

# 2. Renomear: stockflow-main.zip

# 3. Compartilhar o arquivo ZIP
```

### Opção C: OneDrive/Google Drive

```bash
# Carregar pasta para nuvem
# Gerar link compartilhado
# Enviar para usuários
```

---

## 👥 Passo 3: Instruções para Outros Usuários

Envie para eles este texto:

```
🎉 Você recebeu o StockFlow!

Siga EXATAMENTE nesta ordem:

1. Abra: SETUP-LOCAL.md
2. Escolha uma opção:
   - Docker Compose (Mais fácil)
   - Node.js Local
   - Supabase Cloud

3. Se estiver no Windows, pode dar 2 cliques em:
   - STARTUP.bat

4. Espere abrir no navegador em:
   - http://localhost:4173

5. Faça login:
   - Usuário: Administrador
   - PIN: 0000

Dúvidas? Veja SETUP-LOCAL.md
```

---

## 🔐 Segurança: Gerenciar Credenciais

### Se Usar Docker Local:

Não precisa trocar nada. Usa `postgres:postgres` (padrão seguro).

### Se Compartilhar com Equipe:

**⚠️ NUNCA compartilhe credenciais no código!**

Forma segura:

```bash
# Criar .env.example com valores de placeholder
DATABASE_URL=postgres://user:pass@localhost:5432/stockflow
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Cada usuário cria seu próprio .env local
# Com suas próprias credenciais
```

---

## 📋 Checklist de Compartilhamento

Antes de enviar:

- [ ] `.env` NÃO está no git (verificar `.gitignore`)
- [ ] `.env.example` ESTÁ no projeto com placeholders
- [ ] `node_modules` removido
- [ ] Arquivo `SETUP-LOCAL.md` atualizado e claro
- [ ] `STARTUP.bat` ou `startup.sh` disponível
- [ ] `docker-compose.yml` configurado corretamente
- [ ] `package.json` e `package-lock.json` presentes
- [ ] `README.md` referencia `SETUP-LOCAL.md`
- [ ] `.gitignore` está correto

---

## ✅ Verificação Final para Novos Usuários

Depois que o usuário fizer o setup:

1. ✅ Conseguem acessar `http://localhost:4173`?
2. ✅ Conseguem fazer login?
3. ✅ Dashboard carrega com dados?
4. ✅ Conseguem criar retirada de insumo?

Se tudo funcionou: **Projeto está pronto!** 🎉

---

## 🐛 Troubleshooting de Compartilhamento

### Problema: "Arquivo .env foi compartilhado"

```bash
# Remover do histórico Git
git filter-branch --tree-filter 'rm -f .env' HEAD

# Certificar que está no .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Fix: .env now properly ignored"
git push origin main
```

### Problema: "Docker não funciona no PC do colega"

1. Verificar se Docker está instalado e rodando
2. Se não tiver, fornecer link: https://www.docker.com/products/docker-desktop
3. Alternativa: Usar Node.js local (ver SETUP-LOCAL.md)

### Problema: "Porta 4173 já está em uso"

No `.env`, trocar:
```env
PORT=4174  # Ao invés de 4173
```

E reiniciar.

---

## 📞 Suporte para Novos Usuários

Envie também este link se tiverem problemas:
- 📖 **SETUP-LOCAL.md** - Guia completo
- 🐳 **Docker Desktop** - https://www.docker.com
- 🗄️ **PostgreSQL** - https://www.postgresql.org

---

**Pronto para compartilhar com segurança!** ✅
