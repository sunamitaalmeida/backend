const express = require("express");
const router = express.Router();
const { transaction, httpError, numericId, positiveInteger, models } = require("./db");
const { sequelize } = require("../mysql");
const { Entrada, Movimentacao, Produto, Fornecedor } = models;

router.get("/", async (req, res) => {
    const where = {};
    if (req.query.id_produto !== undefined) {
        where.id_produto = numericId(req.query.id_produto, "id_produto");
    }
    if (req.query.id_fornecedor !== undefined) {
        where.id_fornecedor = numericId(req.query.id_fornecedor, "id_fornecedor");
    }
    const entradas = await Entrada.findAll({
        attributes: { include: [[sequelize.col("produto.nome"), "produto"], [sequelize.col("fornecedor.nome"), "fornecedor"]] },
        include: [
            { model: Produto, as: "produto", attributes: [], required: true },
            { model: Fornecedor, as: "fornecedor", attributes: [], required: true }
        ],
        where,
        order: [["id_entrada", "DESC"]],
        raw: true
    });
    res.status(200).json({ entradas });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const entrada = await Entrada.findByPk(id);
    if (!entrada) throw httpError(404, "Entrada não encontrada.");
    res.status(200).json({ entrada });
});

router.post("/", async (req, res) => {
    const idProduto = numericId(req.body.id_produto, "id_produto");
    const idFornecedor = numericId(req.body.id_fornecedor, "id_fornecedor");
    const quantidade = positiveInteger(req.body.quantidade, "quantidade");
    const valorUnitario = Number(req.body.valor_unitario);
    if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
        throw httpError(400, "valor_unitario deve ser um número maior ou igual a zero.");
    }
    const result = await transaction(async ({ transaction: dbTransaction }) => {
        const inserted = await Entrada.create({
            id_produto: idProduto,
            id_fornecedor: idFornecedor,
            quantidade,
            valor_unitario: valorUnitario,
            data_entrada: req.body.data_entrada || sequelize.literal("CURDATE()"),
            observacao: req.body.observacao || null
        }, { transaction: dbTransaction });
        await Movimentacao.create({
            id_produto: idProduto,
            tipo: "E",
            quantidade,
            data_movimentacao: sequelize.literal("NOW()"),
            observacao: req.body.observacao || `Entrada ${inserted.id_entrada}`
        }, { transaction: dbTransaction });
        return inserted;
    });
    res.status(201).json({ mensagem: "Entrada registrada com sucesso.", id_entrada: result.id_entrada });
});

module.exports = router;
