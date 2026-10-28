const express = require("express");
const router = express.Router();
const { query, withConnection, httpError, numericId } = require("./db");

router.get("/", async (req, res) => {
    const conditions = [];
    const values = [];
    if (req.query.id_produto !== undefined) {
        conditions.push("h.id_produto = ?");
        values.push(numericId(req.query.id_produto, "id_produto"));
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const historico = await withConnection((conn) =>
        query(conn, `SELECT h.*, p.nome AS produto FROM historico_precos h LEFT JOIN produtos p ON p.id_produto = h.id_produto ${where} ORDER BY h.vigencia DESC, h.id_historico DESC`, values)
    );
    res.status(200).json({ historico });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [historico] = await withConnection((conn) =>
        query(conn, "SELECT * FROM historico_precos WHERE id_historico = ?", [id])
    );
    if (!historico) throw httpError(404, "Registro de histórico não encontrado.");
    res.status(200).json({ historico });
});

module.exports = router;
