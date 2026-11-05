const express = require("express");
const router = express.Router();
const { httpError, numericId, models } = require("./db");
const { sequelize } = require("../mysql");
const { HistoricoPreco, Produto } = models;

router.get("/", async (req, res) => {
    const where = {};
    if (req.query.id_produto !== undefined) {
        where.id_produto = numericId(req.query.id_produto, "id_produto");
    }
    const historico = await HistoricoPreco.findAll({
        attributes: { include: [[sequelize.col("produto.nome"), "produto"]] },
        include: [{ model: Produto, as: "produto", attributes: [], required: false }],
        where,
        order: [["vigencia", "DESC"], ["id_historico", "DESC"]],
        raw: true
    });
    res.status(200).json({ historico });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const historico = await HistoricoPreco.findByPk(id);
    if (!historico) throw httpError(404, "Registro de histórico não encontrado.");
    res.status(200).json({ historico });
});

module.exports = router;
