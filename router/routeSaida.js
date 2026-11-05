const express = require("express");
const router = express.Router();
const { transaction, httpError, numericId, positiveInteger, models } = require("./db");
const { sequelize } = require("../mysql");
const { Estoque, Saida, Movimentacao, Produto, Funcionario } = models;

router.get("/", async (req, res) => {
    const where = {};
    if (req.query.id_produto !== undefined) {
        where.id_produto = numericId(req.query.id_produto, "id_produto");
    }
    if (req.query.id_funcionario !== undefined) {
        where.id_funcionario = numericId(req.query.id_funcionario, "id_funcionario");
    }
    const saidas = await Saida.findAll({
        attributes: { include: [[sequelize.col("produto.nome"), "produto"], [sequelize.col("funcionario.nome"), "funcionario"]] },
        include: [
            { model: Produto, as: "produto", attributes: [], required: true },
            { model: Funcionario, as: "funcionario", attributes: [], required: true }
        ],
        where,
        order: [["id_saida", "DESC"]],
        raw: true
    });
    res.status(200).json({ saidas });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const saida = await Saida.findByPk(id);
    if (!saida) throw httpError(404, "Saída não encontrada.");
    res.status(200).json({ saida });
});

router.post("/", async (req, res) => {
    const idProduto = numericId(req.body.id_produto, "id_produto");
    const idFuncionario = numericId(req.body.id_funcionario, "id_funcionario");
    const quantidade = positiveInteger(req.body.quantidade, "quantidade");
    const valorUnitario = Number(req.body.valor_unitario);
    if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
        throw httpError(400, "valor_unitario deve ser um número maior ou igual a zero.");
    }

    const result = await transaction(async ({ transaction: dbTransaction }) => {
        const stock = await Estoque.findOne({
            where: { id_produto: idProduto },
            transaction: dbTransaction,
            lock: true
        });
        if (!stock || stock.quantidade < quantidade) {
            throw httpError(409, "Estoque insuficiente para registrar a saída.");
        }
        await stock.update({ quantidade: stock.quantidade - quantidade }, { transaction: dbTransaction });
        const inserted = await Saida.create({
            id_produto: idProduto,
            id_funcionario: idFuncionario,
            quantidade,
            valor_unitario: valorUnitario,
            data_saida: req.body.data_saida || sequelize.literal("CURDATE()"),
            destino: req.body.destino || null
        }, { transaction: dbTransaction });
        await Movimentacao.create({
            id_produto: idProduto,
            tipo: "S",
            quantidade,
            data_movimentacao: sequelize.literal("NOW()"),
            observacao: req.body.destino || `Saída ${inserted.id_saida}`
        }, { transaction: dbTransaction });
        return inserted;
    });
    res.status(201).json({ mensagem: "Saída registrada com sucesso.", id_saida: result.id_saida });
});

module.exports = router;
