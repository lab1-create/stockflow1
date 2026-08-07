# Regras de Negócio e Fluxos do StockFlow

O StockFlow possui fluxos lógicos customizados que garantem que o sistema fique leve, mas mantenha controle estrito sobre o inventário.

## 1. Fluxo de Retirada de Material
O processo ocorre na visão do Admin ou do Técnico:
1. **Identificação**: O Admin seleciona para quem será a retirada (podendo ser Saída Manual se não for um técnico fixo). Se for Técnico logado, isso é preenchido automaticamente.
2. **Identificação do Item**: Leitura do código (com leitor de código de barras físico disparando 'Enter' ou digitação manual).
3. **Destino Fixo**: O aplicativo procura no banco a bancada cadastrada (`default_destination_id`) do técnico que está tirando. Se for uma **Saída Manual**, ele lança automaticamente para "Laboratório" e anota "Para: Nome Digitado" no campo de observação da requisição.
4. **Requisição vs. Baixa**: Se for o Admin operando, a baixa não pode ser direta? (Não, no design atual, até o Admin gera uma Requisição Pending se feito via dashboard, ou já aprova imediatamente dependendo do fluxo). Geralmente vai para `stock_requests` onde é "Liberado" abater no estoque, e assim gera a linha de auditoria em `stock_movements`.

## 2. Insumos Críticos
- A regra de "Crítico" foi simplificada: Qualquer insumo cujo estoque seja `1` ou `0` (<= 1) entra na lista de Críticos no Dashboard.
- **Exportação do Pedido de Compra**: Ao clicar em baixar planilha, o sistema gera um CSV *apenas* com os itens em estado crítico. Este arquivo possui formatação amigável (Colunas: LISTA DE INSUMOS, QUANTIDADE, LINK, VALOR UN., TOTAL), permitindo que o setor financeiro ou de compras processe a compra rapidamente.

## 3. Reposição e Contagem (Ajuste)
Existem duas formas do estoque subir:
- **Reposição (Entrada de Compras)**: O usuário "Bipa" o item recebido e diz que entraram `X` unidades. Isso soma ao estoque total e gera uma tag de movimentação "Reposição".
- **Contagem (Auditoria/Balanço)**: Usado para acerto. Se o sistema diz que existem 10 peças, e fisicamente só contaram 8, o usuário informa `8`. O sistema **substitui** a quantidade do banco para 8 e gera um log do tipo "Ajuste/Contagem" com valor absoluto e anotação "Faltando na contagem". Se sobrou, anota "Sobrando na contagem".

## 4. Divisão de Histórico
A tela de Auditoria Completa separa os logs para melhor legibilidade:
- **Aba "Retiradas e Devoluções"**: Exibe estritamente saídas (quem consumiu) e estornos de consumo (devolução). Fica explícito a Bancada de destino com o ícone de cadeira (🪑).
- **Aba "Reposições, Contagem e Ajustes"**: Filtra apenas entradas massivas, cadastros e ajustes gerenciais. O filtro muda reativamente ao clique sem necessidade de recarregar a página.
