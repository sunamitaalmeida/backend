const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { transaction, httpError, numericId, models } = require("./db");
const { sequelize } = require("../mysql");
const { Estoque, Movimentacao, Produto } = models;

async function findStock(options = {}) {
    return Estoque.findAll({
        attributes: { include: [[sequelize.col("produto.nome"), "produto"]] },
        include: [{ model: Produto, as: "produto", attributes: [], required: true }],
        raw: true,
        ...options
    });
}

router.get("/", async (req, res) => {
    const estoque = await findStock({ order: [[{ model: Produto, as: "produto" }, "nome", "ASC"]] });
    res.status(200).json({ estoque });
});

router.get("/baixo", async (req, res) => {
    const estoque = await findStock({
        where: {
            estoque_minimo: { [Op.ne]: null },
            [Op.and]: [sequelize.where(sequelize.col("quantidade"), Op.lte, sequelize.col("estoque_minimo"))]
        },
        order: [["quantidade", "ASC"]]
    });
    res.status(200).json({ estoque });
});

router.get("/:id_produto", async (req, res) => {
    const idProduto = numericId(req.params.id_produto, "id_produto");
    const [estoque] = await findStock({ where: { id_produto: idProduto } });
    if (!estoque) throw httpError(404, "Registro de estoque não encontrado.");
    res.status(200).json({ estoque });
});

router.patch("/:id_produto", async (req, res) => {
    const idProduto = numericId(req.params.id_produto, "id_produto");
    const values = {};
    for (const field of ["estoque_minimo", "estoque_maximo", "localizacao"]) {
        if (req.body[field] !== undefined) {
            if (field !== "localizacao" && req.body[field] !== null &&
                (!Number.isInteger(Number(req.body[field])) || Number(req.body[field]) < 0)) {
                throw httpError(400, `${field} deve ser um inteiro maior ou igual a zero ou null.`);
            }
            values[field] = req.body[field];
        }
    }
    if (!Object.keys(values).length) throw httpError(400, "Informe ao menos um campo de configuração do estoque.");
    const [updated] = await Estoque.update(values, { where: { id_produto: idProduto } });
    if (!updated && !(await Estoque.findOne({ where: { id_produto: idProduto } }))) {
        throw httpError(404, "Registro de estoque não encontrado.");
    }
    res.status(200).json({ mensagem: "Configurações do estoque atualizadas." });
});

router.post("/:id_produto/ajustes", async (req, res) => {
    const idProduto = numericId(req.params.id_produto, "id_produto");
    const quantidade = Number(req.body.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 0) {
        throw httpError(400, "quantidade deve ser um inteiro maior ou igual a zero.");
    }
    const observacao = typeof req.body.observacao === "string" ? req.body.observacao : "Ajuste manual de estoque";
    const novaQuantidade = await transaction(async ({ transaction: dbTransaction }) => {
        const stock = await Estoque.findOne({
            where: { id_produto: idProduto },
            transaction: dbTransaction,
            lock: true
        });
        if (!stock) throw httpError(404, "Registro de estoque não encontrado.");
        const diferenca = quantidade - stock.quantidade;
        await stock.update({ quantidade }, { transaction: dbTransaction });
        if (diferenca !== 0) {
            await Movimentacao.create({
                id_produto: idProduto,
                tipo: "A",
                quantidade: diferenca,
                data_movimentacao: sequelize.literal("NOW()"),
                observacao
            }, { transaction: dbTransaction });
        }
        return quantidade;
    });
    res.status(200).json({ mensagem: "Estoque ajustado com sucesso.", id_produto: idProduto, quantidade: novaQuantidade });
});

module.exports = router;
