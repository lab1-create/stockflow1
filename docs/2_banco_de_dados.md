# Estrutura do Banco de Dados (Supabase)

O StockFlow utiliza o banco de dados PostgreSQL provido pela plataforma **Supabase**. A arquitetura foi pensada para garantir consistência e auditoria perfeita através de chaves estrangeiras.

## 1. app_users
Tabela que gerencia os acessos e informações de perfil dos operadores do sistema.
- `id` (uuid, primary key)
- `name` (text, único) - Nome do usuário (usado no login)
- `role` (text) - Papel do usuário (`admin` ou `tecnico`)
- `pin_code` (text) - Senha numérica curta para acesso
- `sector` (text) - Setor do usuário
- `active` (boolean) - Status de liberação (novos cadastros nascem como false)
- `default_destination_id` (uuid) - (FK `destinations.id`) A bancada fixa daquele usuário.

## 2. destinations
Controla os destinos (laboratório, bancadas).
- `id` (uuid, pk)
- `name` (text) - Nome do local (ex: Bancada 01)
- `active` (boolean)

## 3. supplies
O catálogo oficial do estoque e das referências de insumos.
- `id` (uuid, pk)
- `code` (text, único) - Código de barras/ID interno (usado na busca e bipagem)
- `name` (text) - Nome do produto
- `category` (text) - Categoria
- `current_quantity` (integer) - Estoque atual dinâmico
- `minimum_quantity` (integer) - Regra de estoque mínimo antigo (substituído por <= 1 na regra de negócio atual)
- `unit_price` (numeric) - Preço unitário (usado na geração do pedido de compras)
- `link` (text) - Link de compra
- `supplier` (text) - Fornecedor principal

## 4. stock_movements
O coração da auditoria. Jamais deve ser deletado. Todos os eventos de alteração de quantidade geram uma linha aqui.
- `id` (uuid, pk)
- `supply_id` (uuid) - FK para `supplies`
- `user_id` (uuid) - FK para `app_users` (quem fez a ação)
- `destination_id` (uuid) - FK para `destinations` (opcional, para retiradas)
- `movement_type` (text) - `withdrawal` (Retirada), `replenishment` (Reposição), `return` (Devolução), `adjustment` (Ajuste/Contagem)
- `quantity` (integer) - Quanto movimentou
- `quantity_before` (integer) - Quanto tinha antes
- `quantity_after` (integer) - Quanto ficou
- `note` (text) - Notas de observação ("Para: Fulano" em saída manual, etc).

## 5. stock_requests
Fila de solicitações de material (quando não se usa a baixa direta) aguardando aprovação do Admin.
- `id` (uuid, pk)
- `supply_id` (uuid, FK)
- `user_id` (uuid, FK)
- `destination_id` (uuid, FK)
- `quantity` (integer)
- `status` (text) - Ex: `pending`, `approved`, `rejected`
- `note` (text) - Usado para identificar os destinatários reais de saídas manuais antes de gerar a movimentação definitiva.

## Row Level Security (RLS)
Neste momento, as regras de RLS (Row Level Security) encontram-se **desativadas** (`DISABLE ROW LEVEL SECURITY`) em todas as tabelas. Isso foi feito para garantir que o front-end via `Anon Key` consiga fazer login e operar integralmente as ações de leitura/escrita. Em futuros passos de segurança alta, sugere-se ativar o RLS e configurar políticas baseadas na autenticação JWT do Supabase, substituindo o login via PIN.
