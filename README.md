# StockFlow

Sistema de controle de insumos para assistencia tecnica.

## 🚀 Guia Rápido de Setup

**Para compartilhar com outros usuários?** Consulte o guia completo:

📖 **[SETUP-LOCAL.md](SETUP-LOCAL.md)** - Instruções detalhadas para desenvolvimento local

Escolha uma opção:
- **Docker Compose** (Recomendado - funciona em qualquer SO)
- **Node.js Local** (Precisa de PostgreSQL instalado)
- **Supabase Cloud** (Banco na nuvem)

---

## O jeito certo para acessar a qualquer hora

Para abrir o StockFlow no navegador a qualquer hora, sem rodar PowerShell, sem clicar em arquivo local e sem depender do computador da loja ligado, publique o app na nuvem.

Depois do deploy, voce acessa por uma URL parecida com:

```text
https://stockflow.onrender.com
```

Ao abrir, o sistema pede uma chave de acesso. Depois disso aparece o login normal:

- Administrador: PIN `0000`
- Tecnicos: PIN `1111`

## Publicar na nuvem com Render

Este projeto ja tem o arquivo `render.yaml`. Ele cria:

- um Web Service Node.js para o StockFlow;
- um banco PostgreSQL na nuvem;
- a variavel `DATABASE_URL`;
- uma `APP_ACCESS_KEY` gerada automaticamente;
- as tabelas e usuarios basicos no primeiro deploy.

Passos:

1. Envie esta pasta para um repositorio no GitHub.
2. Entre em `https://dashboard.render.com`.
3. Clique em `New` e escolha `Blueprint`.
4. Conecte o repositorio do StockFlow.
5. Confirme o blueprint.
6. Aguarde o deploy terminar.
7. Abra a URL gerada pelo Render.

Para ver ou trocar a chave:

1. Abra o servico `stockflow` no Render.
2. Va em `Environment`.
3. Procure `APP_ACCESS_KEY`.
4. Copie a chave ou defina uma nova.
5. Salve e aguarde o redeploy.

## Banco limpo para cadastrar seus produtos

O seed inicial cria apenas usuarios e destinos basicos. Ele nao cadastra produtos, movimentacoes ou solicitacoes.

Para apagar produtos, historico e solicitacoes:

```powershell
npm.cmd run db:clear
```

Na nuvem, rode esse comando pelo Shell/Job da plataforma somente se quiser zerar os produtos.

## Rodar localmente, se quiser testar

O modo local continua existindo, mas e opcional. Para abrir sem PowerShell, de dois cliques em:

```text
StockFlow.vbs
```

Esse modo local depende do seu computador. Para uso real por varias pessoas, prefira a URL da nuvem.
