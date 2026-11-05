const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { httpError, numericId, models } = require("./db");
const { sequelize } = require("../mysql");
const { Movimentacao, Produto } = models;

router.get("/", async (req, res) => {
    const where = {};
    if (req.query.id_produto !== undefined) {
        where.id_produto = numericId(req.query.id_produto, "id_produto");
    }
    if (req.query.tipo !== undefined) {
        if (!["E", "S", "A", "P", "T"].includes(req.query.tipo)) {
            throw httpError(400, "tipo deve ser E, S, A, P ou T.");
        }
        where.tipo = req.query.tipo;
    }
    if (req.query.data_inicio !== undefined) {
        where.data_movimentacao = { [Op.gte]: req.query.data_inicio };
    }
    if (req.query.data_fim !== undefined) {
        const dataFim = new Date(`${req.query.data_fim}T00:00:00.000Z`);
        if (Number.isNaN(dataFim.getTime())) throw httpError(400, "data_fim deve ser uma data válida.");
        dataFim.setUTCDate(dataFim.getUTCDate() + 1);
        where.data_movimentacao = {
            ...(where.data_movimentacao || {}),
            [Op.lt]: dataFim
        };
    }
    const movimentacoes = await Movimentacao.findAll({
        attributes: { include: [[sequelize.col("produto.nome"), "produto"]] },
        include: [{ model: Produto, as: "produto", attributes: [], required: false }],
        where,
        order: [["data_movimentacao", "DESC"], ["id_movimentacao", "DESC"]],
        raw: true
    });
    res.status(200).json({ movimentacoes });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const movimentacao = await Movimentacao.findByPk(id);
    if (!movimentacao) throw httpError(404, "Movimentação não encontrada.");
    res.status(200).json({ movimentacao });
});

module.exports = router;
