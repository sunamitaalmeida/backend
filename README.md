# API de gerenciamento de loja

API REST para apoiar a operação de uma loja: cadastro de dados comerciais, gerenciamento de pedidos e acompanhamento do estoque e de suas movimentações. A aplicação usa Node.js, Express e MySQL.

## Funcionalidades

- Cadastro e manutenção de usuários, funcionários, fornecedores, clientes, categorias e produtos.
- Registro e consulta de pedidos e de seus itens.
- Registro de entradas de produtos e saídas de estoque.
- Consulta do estoque, configuração de limites e localização, alerta de estoque baixo e ajuste manual de quantidade.
- Consulta do histórico de preços dos produtos e das movimentações de estoque.
- Consulta de logs da aplicação.
- Login de usuário por e-mail e senha.

## Executar localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente em um arquivo `.env` na raiz:

   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=seu_usuario
   DB_PASSWORD=sua_senha
   DB_NAME=seu_banco
   ```

3. Crie o banco MySQL e importe o esquema/dados de `sunamitaneres_loja_oficial (1).sql`.

4. Inicie o servidor:

   ```bash
   npm run dev
   ```

   A API ficará disponível em `http://localhost:5000` (ou na porta definida em `PORT`). Para iniciar sem modo de desenvolvimento, use `npm start`.

## Convenções

- Os exemplos e as rotas abaixo usam a URL base `http://localhost:5000`.
- Envie e receba JSON. Para operações com corpo, use `Content-Type: application/json`.
- Os identificadores nas rotas são inteiros positivos.
- Atualizações parciais usam `PATCH`.
- Consultas de coleção retornam listas dentro de uma propriedade JSON, cujo nome pode variar conforme o recurso.
- Erros retornam JSON no formato `{ "erro": { "mensagem": "..." } }`. Identificadores ou recursos inexistentes retornam `404`; dados inválidos retornam `400`.

## Endpoints

### Verificação da API

| Método | Caminho | Descrição |
|---|---|---|
| `GET` | `/teste` | Verifica se o servidor está respondendo. |

### Autenticação e usuários

| Método | Caminho | Descrição |
|---|---|---|
| `POST` | `/login` | Valida credenciais de usuário. |
| `POST` | `/usuario/login` | Mesmo login, disponível também no roteador de usuários. |
| `GET` | `/usuario` | Lista usuários. |
| `GET` | `/usuario/:id` | Consulta um usuário. |
| `POST` | `/usuario` | Cadastra um usuário. |
| `PATCH` | `/usuario/:id` | Atualiza campos permitidos do usuário. |
| `DELETE` | `/usuario/:id` | Remove um usuário. |

Exemplo de requisição de login:

```http
POST /login
Content-Type: application/json
```

```json
{
  "email": "usuario@exemplo.com",
  "senha": "sua_senha"
}
```

Em caso de sucesso, a resposta inclui uma mensagem e os dados do usuário, sem o campo de senha. Credenciais inválidas retornam `401`.

### Cadastros

Os recursos abaixo oferecem `GET /<recurso>` para listar, `GET /<recurso>/:id` para consultar, `POST /<recurso>` para cadastrar, `PATCH /<recurso>/:id` para atualizar parcialmente e `DELETE /<recurso>/:id` para remover:

| Recurso | Caminho | Observações |
|---|---|---|
| Funcionários | `/funcionario` | Cadastro de cargo, salário, contatos, data de admissão e situação ativa. |
| Fornecedores | `/fornecedor` | Cadastro de empresa, contatos, cidade, estado e situação ativa. |
| Clientes | `/cliente` | Cadastro de nome, e-mail, contato e situação ativa. |
| Categorias | `/categoria` | Cadastro de nome, descrição e situação ativa. |
| Produtos | `/produto` | Cadastro de nome, descrição, preço, imagem e categoria. |

O cadastro e a atualização de produtos registram alterações de preço no histórico correspondente.

### Pedidos

| Método | Caminho | Descrição |
|---|---|---|
| `GET` | `/pedido` | Lista pedidos. Filtros opcionais: `id_cliente` e `status` (`0` ou `1`). |
| `GET` | `/pedido/:id` | Consulta um pedido com seus itens. |
| `POST` | `/pedido` | Cria um pedido; pode receber cliente, data, status e itens. |
| `PATCH` | `/pedido/:id` | Atualiza status, data ou cliente do pedido. |
| `DELETE` | `/pedido/:id` | Remove o pedido e seus itens. |
| `GET` | `/pedido/:id/itens` | Lista os itens do pedido. |
| `POST` | `/pedido/:id/itens` | Adiciona item ao pedido. |
| `PATCH` | `/pedido/:id/itens/:idItem` | Atualiza a quantidade de um item. |
| `DELETE` | `/pedido/:id/itens/:idItem` | Remove um item do pedido. |

Exemplo de criação de pedido:

```json
{
  "id_cliente": 1,
  "itens": [
    { "id_produto": 2, "quantidade": 3 }
  ]
}
```

O preço unitário dos itens é obtido do cadastro do produto no momento em que o item é adicionado.

### Estoque e movimentações

| Método | Caminho | Descrição |
|---|---|---|
| `GET` | `/entrada` | Lista entradas; filtros opcionais: `id_produto` e `id_fornecedor`. |
| `GET` | `/entrada/:id` | Consulta uma entrada. |
| `POST` | `/entrada` | Registra entrada e a movimentação correspondente. |
| `GET` | `/saida` | Lista saídas; filtros opcionais: `id_produto` e `id_funcionario`. |
| `GET` | `/saida/:id` | Consulta uma saída. |
| `POST` | `/saida` | Registra saída e baixa a quantidade do estoque. Retorna `409` se não houver quantidade suficiente. |
| `GET` | `/estoque` | Lista os saldos de estoque. |
| `GET` | `/estoque/baixo` | Lista produtos cuja quantidade está no limite mínimo ou abaixo dele. |
| `GET` | `/estoque/:id_produto` | Consulta estoque de um produto. |
| `PATCH` | `/estoque/:id_produto` | Atualiza limite mínimo, limite máximo e/ou localização. |
| `POST` | `/estoque/:id_produto/ajustes` | Define a quantidade atual e registra a diferença como ajuste. |
| `GET` | `/movimentacao` | Consulta movimentações, com filtros opcionais. |
| `GET` | `/movimentacao/:id` | Consulta uma movimentação. |

Filtros disponíveis em `GET /movimentacao`: `id_produto`, `tipo` (`E`, `S`, `A`, `P` ou `T`), `data_inicio` e `data_fim`. Os registros de entrada, saída e ajuste são feitos em transações junto de suas movimentações de estoque.

Exemplo de entrada:

```json
{
  "id_produto": 2,
  "id_fornecedor": 1,
  "quantidade": 10,
  "valor_unitario": 12.5
}
```

Exemplo de saída:

```json
{
  "id_produto": 2,
  "id_funcionario": 1,
  "quantidade": 2,
  "valor_unitario": 15
}
```

### Histórico de preços e logs

| Método | Caminho | Descrição |
|---|---|---|
| `GET` | `/historico-precos` | Lista o histórico de preços; filtro opcional: `id_produto`. |
| `GET` | `/historico-precos/:id` | Consulta um registro do histórico de preços. |
| `GET` | `/produto/:id/historico-precos` | Consulta o histórico de preços de um produto específico. |
| `GET` | `/logs` | Lista logs; filtros opcionais: `tabela_afetada`, `acao` e `limite` (de 1 a 100; padrão 50). |
| `GET` | `/logs/:id` | Consulta um log. |

## Observações

- O login valida as credenciais e retorna os dados do usuário, mas não gera token de sessão/JWT.
- As rotas não aplicam middleware de autenticação ou autorização; portanto, o login não restringe o acesso aos demais endpoints.
- A configuração CORS atual permite requisições de qualquer origem.
- A criação de usuário recebe o campo `senha_hash`; configure e envie o valor de acordo com o formato esperado pela aplicação.
