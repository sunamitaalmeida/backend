const express = require("express");
const router = express.Router();
const { query, withConnection, transaction, httpError, numericId, positiveInteger } = require("./db");

router.get("/", async (req, res) => {
    const filters = [];
    const values = [];
    if (req.query.id_produto !== undefined) {
        filters.push("s.id_produto = ?");
        values.push(numericId(req.query.id_produto, "id_produto"));
    }
    if (req.query.id_funcionario !== undefined) {
        filters.push("s.id_funcionario = ?");
        values.push(numericId(req.query.id_funcionario, "id_funcionario"));
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const saidas = await withConnection((conn) =>
        query(conn, `SELECT s.*, p.nome AS produto, f.nome AS funcionario FROM saidas s JOIN produtos p ON p.id_produto = s.id_produto JOIN funcionarios f ON f.id_funcionario = s.id_funcionario ${where} ORDER BY s.id_saida DESC`, values)
    );
    res.status(200).json({ saidas });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [saida] = await withConnection((conn) =>
        query(conn, "SELECT * FROM saidas WHERE id_saida = ?", [id])
    );
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

    const result = await transaction(async (conn) => {
        const stock = await query(conn, "SELECT quantidade FROM estoque WHERE id_produto = ? FOR UPDATE", [idProduto]);
        if (!stock.length || stock[0].quantidade < quantidade) {
            throw httpError(409, "Estoque insuficiente para registrar a saída.");
        }
        await query(conn, "UPDATE estoque SET quantidade = quantidade - ? WHERE id_produto = ?", [quantidade, idProduto]);
        const inserted = await query(conn,
            "INSERT INTO saidas (id_produto, id_funcionario, quantidade, valor_unitario, data_saida, destino) VALUES (?, ?, ?, ?, COALESCE(?, CURDATE()), ?)",
            [idProduto, idFuncionario, quantidade, valorUnitario, req.body.data_saida || null, req.body.destino || null]
        );
        await query(conn,
            "INSERT INTO movimentacoes (id_produto, tipo, quantidade, data_movimentacao, observacao) VALUES (?, 'S', ?, NOW(), ?)",
            [idProduto, quantidade, req.body.destino || `Saída ${inserted.insertId}`]
        );
        return inserted;
    });
    res.status(201).json({ mensagem: "Saída registrada com sucesso.", id_saida: result.insertId });
});

module.exports = router;
