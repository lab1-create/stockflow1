# Guia de Implantação e Cache (Deploy)

## Como Hospedar o Aplicativo
Dado que o StockFlow foi arquitetado como uma aplicação puramente Client-Side em sua interface (HTML/JS/CSS), sua hospedagem é de nível estático.

- **Hostinger ou cPanel**: Basta copiar os conteúdos que estão DENTRO da pasta `/Public` (ex: `index.html`, `app.js`, `styles.css`) para o diretório raiz web da sua hospedagem (normalmente a pasta `public_html`).
- **Firebase Hosting**: (Hospedagem Atual) Requer a instalação do Firebase CLI. O comando `firebase deploy --only hosting` envia automaticamente tudo o que está mapeado no `firebase.json` (no nosso caso, apontando para a pasta `/Public`).

## O Desafio do Cache de Arquivos
Sistemas PWA (Progressive Web Apps) ou páginas hospedadas na Hostinger podem sofrer de "agressividade" de cache no navegador do celular ou PC. Isso significa que, se você alterar uma lógica, o usuário pode continuar vendo a versão antiga.

### Como resolvemos isso no StockFlow?
Foi implantado o mecanismo de **Cache Busting via Query Strings**. 

1. Toda vez que ocorre uma mudança substancial na programação do aplicativo, nós alteramos o número da versão importada dentro de `index.html`.
2. Linhas cruciais no código:
   - `<link rel="stylesheet" href="styles.css?v=2.7">`
   - `<script src="app.js?v=2.7"></script>`
3. Quando atualizamos para `?v=2.8`, por exemplo, e subimos o arquivo, o navegador do usuário entende que aquele é um arquivo NOVO (pois o nome da requisição mudou). Isso **fura** o cache anterior imediatamente, e a versão nova e corrigida da interface é baixada, garantindo que ninguém opere com código defasado.

## Resumo das Dependências e CDNs
- A importação do cliente do **Supabase** é feita via CDN global, sem precisar de `npm install` ou processos pesados de build do lado do servidor:
  `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
