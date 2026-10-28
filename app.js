//1. Dependências e Middlewares
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

const routeUsuario = require("./router/routeUsuario");
app.post("/login", routeUsuario.loginUsuario);
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

//2. Controle de CORS (Headers & OPTIONS)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));
//3. Definição de Rotas (Exemplo)



app.use("/usuario", routeUsuario);
app.use("/funcionario", routeFuncionario);
app.use("/fornecedor", routeFornecedor);
app.use("/cliente", routeCliente);
app.use("/produto", routeProduto);
app.use("/pedido", routePedido);
app.use("/categoria", routeCategoria);
app.use("/entrada", routeEntrada);
app.use("/estoque", routeEstoque);
app.use("/saida", routeSaida);
app.use("/movimentacao", routeMovimentacao);
app.use("/historico-precos", routeHistoricoPrecos);
app.use("/logs", routeLogs);


app.get('/teste', (req, res) => {
    res.status(200).send({
        mensagem: 'Tudo OK'
    }); 
});
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




