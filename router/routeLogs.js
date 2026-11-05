const express = require("express");
const router = express.Router();
const { httpError, numericId, models } = require("./db");
const { Log } = models;

router.get("/", async (req, res) => {
    const where = {};
    if (req.query.tabela_afetada !== undefined) {
        where.tabela_afetada = req.query.tabela_afetada;
    }
    if (req.query.acao !== undefined) {
        where.acao = req.query.acao;
    }
    const limite = req.query.limite === undefined ? 50 : Number(req.query.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
        throw httpError(400, "limite deve ser um inteiro entre 1 e 100.");
    }
    const logs = await Log.findAll({
        where,
        order: [["data_hora", "DESC"], ["id_log", "DESC"]],
        limit: limite
    });
    res.status(200).json({ logs });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const log = await Log.findByPk(id);
    if (!log) throw httpError(404, "Log não encontrado.");
    res.status(200).json({ log });
});

module.exports = router;
