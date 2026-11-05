# API de gerenciamento de loja

## Objetivo

A API de gerenciamento de loja fornece uma interface REST para administrar cadastros comerciais, produtos, pedidos e estoque. Ela centraliza essas operações e mantém relacionadas as informações de entradas, saídas, movimentações e histórico de preços.

### Problema que resolve

Sem um serviço central, os dados de clientes, fornecedores, produtos, pedidos e saldos podem ficar dispersos e inconsistentes. A API disponibiliza operações padronizadas para consultar e atualizar esses dados e, em operações de estoque e pedidos, agrupa gravações relacionadas em transações para preservar sua consistência.

## Tecnologias

- **Backend:** Node.js (CommonJS) e Express 5.
- **ORM:** Sequelize 6. Mapeia as tabelas do banco para modelos JavaScript e oferece consultas, filtros, associações e transações. Algumas expressões específicas usam recursos SQL por meio do Sequelize.
- **Banco de dados:** MySQL, usando o driver `mysql2`. MariaDB pode ser utilizado quando compatível com o esquema.
- **Outras dependências:** `bcryptjs` para verificar senhas bcrypt; `dotenv` para carregar configuração local; `cors` para CORS; `body-parser` para JSON/formulários; `morgan` para log HTTP. `nodemon` é usado nos scripts de execução.

Os modelos e associações estão em `mysql.js`. A aplicação usa o esquema existente e não cria nem sincroniza tabelas automaticamente.

## Instalação e execução

Requisitos: Node.js 20 ou superior, npm e um servidor MySQL/MariaDB com o esquema da aplicação.

1. Instale as dependências na raiz do projeto:

   ```bash
   npm install
   ```

2. Crie um banco vazio e importe o esquema/dados de `sunamitaneres_loja_oficial (1).sql`, ou configure um banco já preparado com esse esquema.

3. Crie um arquivo `.env` na raiz com as variáveis listadas abaixo. Use os valores do seu ambiente; não publique senhas nem credenciais:

   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=seu_usuario
   DB_PASSWORD=sua_senha
   DB_NAME=seu_banco
   JWT_SECRET=gere_uma_chave_aleatoria_com_ao_menos_32_bytes
   CORS_ORIGIN=http://localhost:3000
   ```

   Gere uma chave para `JWT_SECRET` com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` e guarde-a somente no ambiente local ou no gerenciador de segredos do serviço. Não use a chave ilustrativa acima em execução.

4. Se o banco já existia antes da inclusão de papéis, aplique uma única vez a migração `migrations/20261104-add-user-role.sql` antes de iniciar a versão nova. Usuários existentes passam ao papel restrito `consulta`. Bancos novos importados do SQL atualizado já incluem a coluna.

5. Crie o primeiro usuário administrador por uma sessão de terminal local:

   ```bash
   npm run create-user -- "Administrador" admin@exemplo.com admin
   ```

   O comando solicita a senha sem exibi-la e grava somente o hash bcrypt. A senha deve ter entre 12 e 72 bytes. Papéis aceitos: `admin`, `vendas`, `estoque` e `consulta`; o padrão é `consulta`. Mantenha `admin` apenas para pessoas de confiança.

6. Inicie em desenvolvimento:

   ```bash
   npm run dev
   ```

   `npm start` inicia `server.js` diretamente; `npm run dev` usa nodemon. A API exige `JWT_SECRET` com pelo menos 32 bytes e testa a conexão com o banco antes de abrir o servidor.

### Variáveis de ambiente

| Variável | Obrigatória | Finalidade |
|---|---|---|
| `DB_HOST` | Sim | Host do MySQL/MariaDB. |
| `DB_PORT` | Não | Porta do banco; padrão `3306`. Deve ser um inteiro entre `1` e `65535`. |
| `DB_USER` | Sim | Usuário do banco. |
| `DB_PASSWORD` | Sim | Senha do usuário do banco. |
| `DB_NAME` | Sim | Nome do banco/schema. |
| `PORT` | Não | Porta HTTP da API; padrão `5000`. Deve ser um inteiro entre `1` e `65535`; o Render define este valor automaticamente. |
| `JWT_SECRET` | Sim | Segredo aleatório de pelo menos 32 bytes para assinar e validar JWT. Mantenha-o privado e estável enquanto tokens emitidos estiverem válidos. |
| `CORS_ORIGIN` | Não | Origens web permitidas, separadas por vírgula. Em desenvolvimento, se omitida, a API permite qualquer origem. Em produção, `*` permite requisições cross-origin de qualquer site; prefira os domínios conhecidos do frontend quando disponíveis. Sem a variável, nenhum acesso de navegador cross-origin é liberado. |

O arquivo `.env` contém valores locais e não deve ser compartilhado ou enviado ao controle de versão.

Na inicialização, o servidor valida as variáveis obrigatórias e testa a conexão MySQL antes de aceitar requisições. Em encerramentos do Render (`SIGTERM`/`SIGINT`), para de aceitar conexões e fecha o pool do banco. Use para a aplicação um usuário MySQL dedicado, com acesso somente ao schema da API e às operações necessárias; não use `root` nem conceda privilégios globais. As regras de papéis (`admin`, `vendas`, `estoque`, `consulta`) são aplicadas pela API e não substituem o controle de acesso do banco.

## Endereço da API

- **Local:** `http://localhost:5000` (ou `http://localhost:<PORT>` se `PORT` for diferente).
- **Público:** a configuração de blueprint para Render está em `render.yaml`, mas o domínio só é atribuído após o deploy. Configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` e `JWT_SECRET` no painel. Quando publicar o frontend, configure também `CORS_ORIGIN` com sua origem HTTPS.

## Formato das requisições e respostas

- Os exemplos usam a URL base `http://localhost:5000`.
- Envie corpos JSON com `Content-Type: application/json`.
- IDs de rota devem ser inteiros positivos. Atualizações parciais usam `PATCH`.
- Respostas de sucesso são JSON. Listas vêm em uma propriedade correspondente ao recurso, como `clientes`, `pedidos` ou `estoque`; o nome exato é indicado na resposta de cada rota.
- Cadastros retornam `201 Created`, normalmente com `mensagem` e o identificador criado. Consultas, alterações e exclusões bem-sucedidas retornam `200 OK`.
- Erros da aplicação usam o formato `{ "erro": { "mensagem": "..." } }`. Em geral, dados inválidos retornam `400`, recurso inexistente `404`, credenciais de login inválidas `401` e saída sem estoque suficiente `409`. Erros inesperados podem retornar `500`.

Exemplo de resposta de cadastro:

```json
{
  "mensagem": "Cliente criado com sucesso.",
  "id_cliente": 12
}
```

## Rotas disponíveis

### Saúde

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/teste` | Verifica se o servidor HTTP está respondendo (`200`), sem consultar o banco. |
| `GET` | `/health` | Verifica a prontidão da API e a conexão com o banco (`200`; retorna `503` quando o banco não está disponível). Usado pelo health check do Render. |

### Usuários e login

| Método | Rota | Finalidade |
|---|---|---|
| `POST` | `/login` | Valida e-mail e senha; retorna JWT. |
| `POST` | `/usuario/login` | Mesmo login, disponível pelo roteador de usuários; retorna JWT. |
| `GET` | `/usuario` | Lista usuários sem retornar `senha_hash`. |
| `GET` | `/usuario/:id` | Consulta usuário sem retornar `senha_hash`. |
| `POST` | `/usuario` | Cadastra usuário; recebe `senha_hash`. |
| `PATCH` | `/usuario/:id` | Atualiza campos permitidos (não permite atualizar `senha_hash`). |
| `PATCH` | `/usuario/:id/papel` | Admin altera papel para `admin`, `vendas`, `estoque` ou `consulta`. |
| `DELETE` | `/usuario/:id` | Remove usuário. |

Para `/login` e `/usuario/login`, envie:

```json
{
  "email": "usuario@exemplo.com",
  "senha": "senha_em_texto"
}
```

No sucesso, a resposta é `200` e contém `mensagem`, `usuario` (sem o hash da senha) e `token` JWT, válido por uma hora. Credenciais inválidas ou usuário inativo retornam `401`. Rotas protegidas também retornam `401` quando o token está ausente, inválido ou expirado.

Use o token nas rotas protegidas:

```http
Authorization: Bearer <token>
```

### Recursos CRUD

Cada recurso abaixo oferece `GET /<recurso>` (lista), `GET /<recurso>/:id` (detalhe), `POST /<recurso>` (cadastro), `PATCH /<recurso>/:id` (atualização parcial) e `DELETE /<recurso>/:id` (exclusão).

| Recurso | Caminho | Finalidade |
|---|---|---|
| Funcionários | `/funcionario` | Gerencia nome, cargo, salário, contatos, admissão e situação ativa. |
| Fornecedores | `/fornecedor` | Gerencia nome, empresa, contatos, cidade, estado e situação ativa. |
| Clientes | `/cliente` | Gerencia nome, e-mail, contato e situação ativa. |
| Categorias | `/categoria` | Gerencia nome, descrição e situação ativa. |
| Produtos | `/produto` | Gerencia nome, descrição, preço, imagem e categoria. Cadastro e alteração de preço atualizam o histórico de preços. |

### Pedidos e itens

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/pedido` | Lista pedidos; filtros: `id_cliente` e `status` (`0` ou `1`). |
| `GET` | `/pedido/:id` | Consulta pedido, cliente e itens. |
| `POST` | `/pedido` | Cria pedido e, opcionalmente, seus itens. |
| `PATCH` | `/pedido/:id` | Atualiza `status`, `data_pedido` e/ou `id_cliente`. |
| `DELETE` | `/pedido/:id` | Exclui pedido e itens associados. |
| `GET` | `/pedido/:id/itens` | Lista itens de um pedido. |
| `POST` | `/pedido/:id/itens` | Adiciona item ao pedido. |
| `PATCH` | `/pedido/:id/itens/:idItem` | Atualiza a quantidade do item. |
| `DELETE` | `/pedido/:id/itens/:idItem` | Remove item do pedido. |

Exemplo de `POST /pedido`:

```json
{
  "id_cliente": 1,
  "itens": [
    { "id_produto": 2, "quantidade": 3 }
  ]
}
```

O preço unitário de cada item é lido do produto no momento em que o item é adicionado.

### Estoque e movimentações

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/entrada` | Lista entradas; filtros: `id_produto` e `id_fornecedor`. |
| `GET` | `/entrada/:id` | Consulta uma entrada. |
| `POST` | `/entrada` | Registra entrada e movimentação correspondente. |
| `GET` | `/saida` | Lista saídas; filtros: `id_produto` e `id_funcionario`. |
| `GET` | `/saida/:id` | Consulta uma saída. |
| `POST` | `/saida` | Registra saída e reduz o estoque; responde `409` se não houver quantidade suficiente. |
| `GET` | `/estoque` | Lista saldos de estoque. |
| `GET` | `/estoque/baixo` | Lista produtos no limite mínimo ou abaixo dele. |
| `GET` | `/estoque/:id_produto` | Consulta o estoque de um produto. |
| `PATCH` | `/estoque/:id_produto` | Atualiza limites mínimo/máximo e/ou localização. |
| `POST` | `/estoque/:id_produto/ajustes` | Define quantidade e registra a diferença como ajuste. |
| `GET` | `/movimentacao` | Lista movimentações; filtros: `id_produto`, `tipo`, `data_inicio` e `data_fim`. |
| `GET` | `/movimentacao/:id` | Consulta uma movimentação. |

Os tipos de movimentação aceitos no filtro `tipo` são `E`, `S`, `A`, `P` e `T`. Exemplos de corpos:

```json
{
  "id_produto": 2,
  "id_fornecedor": 1,
  "quantidade": 10,
  "valor_unitario": 12.5
}
```

Esse corpo registra uma entrada em `POST /entrada`. Para `POST /saida`, use `id_funcionario` no lugar de `id_fornecedor`. Entradas, saídas e ajustes são gravados em transações junto das movimentações relacionadas.

### Histórico de preços e logs

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/historico-precos` | Lista histórico; filtro opcional: `id_produto`. |
| `GET` | `/historico-precos/:id` | Consulta um registro de histórico de preços. |
| `GET` | `/produto/:id/historico-precos` | Lista histórico de preços do produto. |
| `GET` | `/logs` | Lista logs; filtros: `tabela_afetada`, `acao`, `limite` (1–100; padrão 50). |
| `GET` | `/logs/:id` | Consulta um log. |

## Criar usuário e testar login

Para criar o primeiro administrador, utilize o comando interativo de bootstrap acima. Para cadastrar usuários subsequentes pela API, faça login e envie o token retornado no cabeçalho `Authorization`. O cadastro recebe `senha_hash`, e não o campo `senha`; novos cadastros recebem o papel `consulta`, que só um administrador pode alterar pela rota `PATCH /usuario/:id/papel`. Gere o hash bcrypt localmente:

```bash
node -e "require('bcryptjs').hash('senha_de_teste', 10).then(console.log)"
```

Use o hash gerado no corpo de cadastro:

```http
POST /usuario
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "nome": "Usuário de teste",
  "email": "teste@exemplo.com",
  "senha_hash": "$2a$10$substitua_pelo_hash_bcrypt_gerado",
  "ativo": 1
}
```

Depois, teste o login usando a senha original (não o hash):

```http
POST /login
Content-Type: application/json
```

```json
{
  "email": "teste@exemplo.com",
  "senha": "senha_de_teste"
}
```

Não reutilize a senha ilustrativa em produção. O login compara hashes bcrypt; valores legados armazenados em texto simples são convertidos para bcrypt no primeiro login bem-sucedido.

## Autenticação e acesso

As rotas `GET /teste`, `POST /login` e `POST /usuario/login` são públicas. Todas as demais rotas exigem um JWT válido no cabeçalho Bearer, associado a um usuário ativo. Tokens expiram em uma hora; após isso, faça login novamente. A API verifica o usuário, seu estado ativo e seu papel em cada requisição protegida. Acesso não permitido pelo papel retorna `403`.

| Papel | Permissões |
|---|---|
| `admin` | Acesso completo, incluindo funcionários, usuários, alteração de papéis e logs. |
| `vendas` | Clientes e pedidos; leitura de produtos, categorias, estoque e histórico de preços. |
| `estoque` | Entradas, saídas, estoque e movimentações; leitura de fornecedores, produtos, categorias e histórico de preços. |
| `consulta` | Leitura de produtos, categorias, estoque, histórico de preços e movimentações. |

O acesso ao cadastro, consulta, atualização e exclusão de usuários e a logs é exclusivo de `admin`. Usuários existentes recebem o papel `consulta` na migração e precisam de promoção explícita por um administrador ou por operação local autorizada.

Em desenvolvimento, CORS permite qualquer origem se `CORS_ORIGIN` não estiver definida. O blueprint Render define `CORS_ORIGIN=*` para que o frontend possa ser conectado sem conhecer previamente seu domínio; isso autoriza o acesso do navegador de qualquer origem, sem liberar credenciais por cookie. Quando o domínio do frontend estiver definido, substitua `*` pelas origens HTTPS específicas, separadas por vírgula. CORS não substitui autenticação ou autorização.

## Testes

Execute `npm test` para verificar conexão com banco, login, validação de credenciais, emissão de token e proteção das rotas. A suíte cria um usuário temporário com e-mail aleatório e o remove ao terminar; precisa de um banco de desenvolvimento/teste configurado pelas variáveis de ambiente. Não execute contra produção.
