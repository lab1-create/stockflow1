# Visão Geral do Sistema StockFlow

O **StockFlow** é um sistema de gestão de estoque focado no controle de insumos e auditoria completa de saídas, devoluções, reposições e contagens. Ele é construído como uma *Single Page Application* (SPA), focando em velocidade, resiliência e usabilidade, sem exigir uma infraestrutura complexa de backend rodando (Serverless).

## Principais Funcionalidades Implementadas

1. **Gestão de Usuários e Níveis de Acesso**
   - Usuários divididos em *Admin* e *Técnico*.
   - Acesso por nome + PIN (senha numérica rápida).
   - Tela de aprovação de novos cadastros (pendentes de aprovação pelo admin).

2. **Fluxo de Insumos (Retirada e Devolução)**
   - Tela otimizada para "Bipar" insumos ou digitar o código rapidamente.
   - Retirada com **Destino Fixo**: Cada usuário possui uma "Bancada" padrão (ex: Luiz -> Bancada 1).
   - **Retirada Manual**: Permite registrar a saída de material para pessoas sem login (visitantes ou sem acesso), amarrando a ação a quem operou o sistema.
   - Validação de quantidade (para devolução só permite se o usuário tiver retirado anteriormente).

3. **Reposição e Balanço (Auditoria/Contagem)**
   - Reposição rápida para entrada de estoque (compras).
   - Sistema de contagem física (*Auditoria*): se a contagem física for diferente do sistema, gera uma movimentação de "Ajuste/Contagem" automática para mais ou para menos, documentando a diferença.

4. **Regras de Estoque Crítico**
   - Um insumo é classificado como **CRÍTICO** quando o estoque atinge `1` ou `0`.
   - Há um painel de alerta direto na tela inicial.
   - Botão para exportar uma **Planilha de Pedido de Compra** (CSV) já com colunas formatadas (Nome, Quantidade, Link, Valor Un., Total) contendo apenas os itens críticos.

5. **Aprovação de Requisições**
   - Opção para que retiradas vão para uma fila de aprovação (Painel do Admin) antes de abater no estoque.

6. **Histórico e Relatórios**
   - Histórico em tempo real na tela principal (últimas 5 movimentações).
   - Aba dedicada a **Auditoria Completa** segmentada em abas de filtro rápido:
     - *Aba 1*: Retiradas e Devoluções.
     - *Aba 2*: Reposição, Contagem e Ajustes.
   - Exportação do Histórico Completo para planilha.

## Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript puro. (Nenhum framework React/Vue usado para manter a leveza extrema).
- **Backend**: Supabase (PostgreSQL) servindo APIs e autenticação.
- **Ícones/Design**: Estilo Dark Mode moderno, glow effects, responsividade para celular e desktop.
- **PWA (Progressive Web App)**: Configurável via `manifest.json` para instalação como app em Android/iOS.
