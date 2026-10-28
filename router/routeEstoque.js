const express = require("express");
const router = express.Router();
const { query, withConnection, transaction, httpError, numericId } = require("./db");

router.get("/", async (req, res) => {
    const estoque = await withConnection((conn) =>
        query(conn, "SELECT e.*, p.nome AS produto FROM estoque e JOIN produtos p ON p.id_produto = e.id_produto ORDER BY p.nome")
    );
    res.status(200).json({ estoque });
});

router.get("/baixo", async (req, res) => {
    const estoque = await withConnection((conn) =>
        query(conn, "SELECT e.*, p.nome AS produto FROM estoque e JOIN produtos p ON p.id_produto = e.id_produto WHERE e.estoque_minimo IS NOT NULL AND e.quantidade <= e.estoque_minimo ORDER BY e.quantidade")
    );
    res.status(200).json({ estoque });
});

router.get("/:id_produto", async (req, res) => {
    const idProduto = numericId(req.params.id_produto, "id_produto");
    const [estoque] = await withConnection((conn) =>
        query(conn, "SELECT e.*, p.nome AS produto FROM estoque e JOIN produtos p ON p.id_produto = e.id_produto WHERE e.id_produto = ?", [idProduto])
    );
    if (!estoque) throw httpError(404, "Registro de estoque não encontrado.");
    res.status(200).json({ estoque });
});

router.patch("/:id_produto", async (req, res) => {
    const idProduto = numericId(req.params.id_produto, "id_produto");
    const fields = [];
    const values = [];
    for (const field of ["estoque_minimo", "estoque_maximo", "localizacao"]) {
        if (req.body[field] !== undefined) {
            if (field !== "localizacao" && req.body[field] !== null &&
                (!Number.isInteger(Number(req.body[field])) || Number(req.body[field]) < 0)) {
                throw httpError(400, `${field} deve ser um inteiro maior ou igual a zero ou null.`);
            }
            fields.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }
    if (!fields.length) throw httpError(400, "Informe ao menos um campo de configuração do estoque.");
    values.push(idProduto);
    const result = await withConnection((conn) =>
        query(conn, `UPDATE estoque SET ${fields.join(", ")} WHERE id_produto = ?`, values)
    );
    if (!result.affectedRows) {
        const [exists] = await withConnection((conn) =>
            query(conn, "SELECT id_produto FROM estoque WHERE id_produto = ?", [idProduto])
        );
        if (!exists) throw httpError(404, "Registro de estoque não encontrado.");
    }
    res.status(200).json({ mensagem: "Configurações do estoque atualizadas." });
});

router.post("/:id_produto/ajustes", async (req, res) => {
    const idProduto = numericId(req.params.id_produto, "id_produto");
    const quantidade = Number(req.body.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 0) {
        throw httpError(400, "quantidade deve ser um inteiro maior ou igual a zero.");
    }
    const observacao = typeof req.body.observacao === "string" ? req.body.observacao : "Ajuste manual de estoque";
    const novaQuantidade = await transaction(async (conn) => {
        const [stock] = await query(conn, "SELECT quantidade FROM estoque WHERE id_produto = ? FOR UPDATE", [idProduto]);
        if (!stock) throw httpError(404, "Registro de estoque não encontrado.");
        const diferenca = quantidade - stock.quantidade;
        await query(conn, "UPDATE estoque SET quantidade = ? WHERE id_produto = ?", [quantidade, idProduto]);
        if (diferenca !== 0) {
            await query(conn,
                "INSERT INTO movimentacoes (id_produto, tipo, quantidade, data_movimentacao, observacao) VALUES (?, 'A', ?, NOW(), ?)",
                [idProduto, diferenca, observacao]
            );
        }
        return quantidade;
    });
    res.status(200).json({ mensagem: "Estoque ajustado com sucesso.", id_produto: idProduto, quantidade: novaQuantidade });
});

module.exports = router;
