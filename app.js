//1. Dependências e Middlewares
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const { authenticate, authorizeRoles } = require("./router/auth");
const { sequelize } = require("./mysql");
const configuredOrigins = (process.env.CORS_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean);
const corsOrigin = configuredOrigins.length
  ? configuredOrigins.length === 1 && configuredOrigins[0] === "*" ? "*" : configuredOrigins
  : process.env.NODE_ENV === "production" ? false : "*";
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

//2. Controle de CORS (Headers & OPTIONS)
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

const routeUsuario = require("./router/routeUsuario");
app.post("/login", routeUsuario.loginUsuario);
app.post("/usuario/login", routeUsuario.loginUsuario);
app.get('/teste', (req, res) => {
    res.status(200).send({
        mensagem: 'Tudo OK'
    });
});
app.get('/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        return res.status(200).json({ status: "ok" });
    } catch (error) {
        console.error("Health check do banco falhou:", error);
        return res.status(503).json({ status: "unavailable" });
    }
});

app.use(authenticate);

const routeFuncionario = require("./router/routeFuncionario");
const routeFornecedor = require("./router/routeFornecedor");
const routeCliente = require("./router/routeCliente");
const routeProduto = require("./router/routeProduto");
const routePedido = require("./router/routePedido");
const routeCategoria = require("./router/routeCategoria");
const routeEntrada = require("./router/routeEntrada");
const routeEstoque = require("./router/routeEstoque");
const routeSaida = require("./router/routeSaida");
const routeMovimentacao = require("./router/routeMovimentacao");
const routeHistoricoPrecos = require("./router/routeHistoricoPrecos");
const routeLogs = require("./router/routeLogs");

//3. Definição de Rotas (Exemplo)



app.use("/usuario", authorizeRoles({ roles: ["admin"] }), routeUsuario);
app.use("/funcionario", authorizeRoles({ roles: ["admin"] }), routeFuncionario);
app.use("/fornecedor", authorizeRoles({ roles: ["admin"], readOnlyRoles: ["estoque"] }), routeFornecedor);
app.use("/cliente", authorizeRoles({ roles: ["admin", "vendas"] }), routeCliente);
app.use("/produto", authorizeRoles({ roles: ["admin"], readOnlyRoles: ["vendas", "estoque", "consulta"] }), routeProduto);
app.use("/pedido", authorizeRoles({ roles: ["admin", "vendas"] }), routePedido);
app.use("/categoria", authorizeRoles({ roles: ["admin"], readOnlyRoles: ["vendas", "estoque", "consulta"] }), routeCategoria);
app.use("/entrada", authorizeRoles({ roles: ["admin", "estoque"] }), routeEntrada);
app.use("/estoque", authorizeRoles({ roles: ["admin", "estoque"], readOnlyRoles: ["vendas", "consulta"] }), routeEstoque);
app.use("/saida", authorizeRoles({ roles: ["admin", "estoque"] }), routeSaida);
app.use("/movimentacao", authorizeRoles({ roles: ["admin", "estoque"], readOnlyRoles: ["consulta"] }), routeMovimentacao);
app.use("/historico-precos", authorizeRoles({ roles: ["admin", "estoque"], readOnlyRoles: ["vendas", "consulta"] }), routeHistoricoPrecos);
app.use("/logs", authorizeRoles({ roles: ["admin"] }), routeLogs);


//4. Tratamento de Erros (Fallback & Handler)
app.use((req,res,next)=>{
      const erro = new Error("Não encontrado!");
      erro.status = 404;
      next(erro);
});
app.use((error,req,res,next)=>{
        res.status(error.status || 500);
        return res.json({
            erro:{
                 mensagem:error.message
            }  })
})

module.exports = app
