const express = require("express");
const router = express.Router();
const { query, withConnection, transaction, httpError, numericId, positiveInteger } = require("./db");

router.get("/", async (req, res) => {
    const filters = [];
    const values = [];
    if (req.query.id_produto !== undefined) {
        filters.push("e.id_produto = ?");
        values.push(numericId(req.query.id_produto, "id_produto"));
    }
    if (req.query.id_fornecedor !== undefined) {
        filters.push("e.id_fornecedor = ?");
        values.push(numericId(req.query.id_fornecedor, "id_fornecedor"));
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const entradas = await withConnection((conn) =>
        query(conn, `SELECT e.*, p.nome AS produto, f.nome AS fornecedor FROM entradas e JOIN produtos p ON p.id_produto = e.id_produto JOIN fornecedores f ON f.id_fornecedor = e.id_fornecedor ${where} ORDER BY e.id_entrada DESC`, values)
    );
    res.status(200).json({ entradas });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [entrada] = await withConnection((conn) =>
        query(conn, "SELECT * FROM entradas WHERE id_entrada = ?", [id])
    );
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
    const result = await transaction(async (conn) => {
        const inserted = await query(conn,
            "INSERT INTO entradas (id_produto, id_fornecedor, quantidade, valor_unitario, data_entrada, observacao) VALUES (?, ?, ?, ?, COALESCE(?, CURDATE()), ?)",
            [idProduto, idFornecedor, quantidade, valorUnitario, req.body.data_entrada || null, req.body.observacao || null]
        );
        await query(conn,
            "INSERT INTO movimentacoes (id_produto, tipo, quantidade, data_movimentacao, observacao) VALUES (?, 'E', ?, NOW(), ?)",
            [idProduto, quantidade, req.body.observacao || `Entrada ${inserted.insertId}`]
        );
        return inserted;
    });
    res.status(201).json({ mensagem: "Entrada registrada com sucesso.", id_entrada: result.insertId });
});

module.exports = router;
