const express = require("express");
const router = express.Router();
const { query, withConnection, httpError, numericId } = require("./db");

router.get("/", async (req, res) => {
    const conditions = [];
    const values = [];
    if (req.query.tabela_afetada !== undefined) {
        conditions.push("tabela_afetada = ?");
        values.push(req.query.tabela_afetada);
    }
    if (req.query.acao !== undefined) {
        conditions.push("acao = ?");
        values.push(req.query.acao);
    }
    const limite = req.query.limite === undefined ? 50 : Number(req.query.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
        throw httpError(400, "limite deve ser um inteiro entre 1 e 100.");
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const logs = await withConnection((conn) =>
        query(conn, `SELECT * FROM logs ${where} ORDER BY data_hora DESC, id_log DESC LIMIT ?`, [...values, limite])
    );
    res.status(200).json({ logs });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [log] = await withConnection((conn) =>
        query(conn, "SELECT * FROM logs WHERE id_log = ?", [id])
    );
    if (!log) throw httpError(404, "Log não encontrado.");
    res.status(200).json({ log });
});

module.exports = router;
