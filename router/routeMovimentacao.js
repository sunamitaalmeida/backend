const express = require("express");
const router = express.Router();
const { query, withConnection, httpError, numericId } = require("./db");

router.get("/", async (req, res) => {
    const conditions = [];
    const values = [];
    if (req.query.id_produto !== undefined) {
        conditions.push("m.id_produto = ?");
        values.push(numericId(req.query.id_produto, "id_produto"));
    }
    if (req.query.tipo !== undefined) {
        if (!["E", "S", "A", "P", "T"].includes(req.query.tipo)) {
            throw httpError(400, "tipo deve ser E, S, A, P ou T.");
        }
        conditions.push("m.tipo = ?");
        values.push(req.query.tipo);
    }
    if (req.query.data_inicio !== undefined) {
        conditions.push("m.data_movimentacao >= ?");
        values.push(req.query.data_inicio);
    }
    if (req.query.data_fim !== undefined) {
        conditions.push("m.data_movimentacao < DATE_ADD(?, INTERVAL 1 DAY)");
        values.push(req.query.data_fim);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const movimentacoes = await withConnection((conn) =>
        query(conn, `SELECT m.*, p.nome AS produto FROM movimentacoes m LEFT JOIN produtos p ON p.id_produto = m.id_produto ${where} ORDER BY m.data_movimentacao DESC, m.id_movimentacao DESC`, values)
    );
    res.status(200).json({ movimentacoes });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [movimentacao] = await withConnection((conn) =>
        query(conn, "SELECT * FROM movimentacoes WHERE id_movimentacao = ?", [id])
    );
    if (!movimentacao) throw httpError(404, "Movimentação não encontrada.");
    res.status(200).json({ movimentacao });
});

module.exports = router;
