const express = require("express");
const router = express.Router();
const { query, withConnection, transaction, httpError, numericId, positiveInteger } = require("./db");

async function addItem(connection, idPedido, item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw httpError(400, "Cada item deve ser um objeto com id_produto e quantidade.");
    }
    const idProduto = numericId(item.id_produto, "id_produto");
    const quantidade = positiveInteger(item.quantidade, "quantidade");
    const [produto] = await query(connection, "SELECT preco FROM produtos WHERE id_produto = ?", [idProduto]);
    if (!produto) throw httpError(404, `Produto ${idProduto} não encontrado.`);
    const result = await query(connection,
        "INSERT INTO pedido_itens (id_pedido, id_produto, quantidade, valor_unitario, subtotal) VALUES (?, ?, ?, ?, ROUND(? * ?, 2))",
        [idPedido, idProduto, quantidade, produto.preco, quantidade, produto.preco]
    );
    return result.insertId;
}

router.get("/", async (req, res) => {
    const conditions = [];
    const values = [];
    if (req.query.id_cliente !== undefined) {
        conditions.push("p.id_cliente = ?");
        values.push(numericId(req.query.id_cliente, "id_cliente"));
    }
    if (req.query.status !== undefined) {
        const status = Number(req.query.status);
        if (![0, 1].includes(status)) throw httpError(400, "status deve ser 0 ou 1.");
        conditions.push("p.status = ?");
        values.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const pedidos = await withConnection((conn) =>
        query(conn, `SELECT p.*, c.nome AS cliente FROM pedidos p LEFT JOIN clientes c ON c.id_cliente = p.id_cliente ${where} ORDER BY p.id_pedido DESC`, values)
    );
    res.status(200).json({ pedidos });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const pedido = await withConnection(async (conn) => {
        const [cabecalho] = await query(conn, "SELECT p.*, c.nome AS cliente FROM pedidos p LEFT JOIN clientes c ON c.id_cliente = p.id_cliente WHERE p.id_pedido = ?", [id]);
        if (!cabecalho) return null;
        cabecalho.itens = await query(conn,
            "SELECT i.*, p.nome AS produto FROM pedido_itens i LEFT JOIN produtos p ON p.id_produto = i.id_produto WHERE i.id_pedido = ? ORDER BY i.id_item",
            [id]
        );
        return cabecalho;
    });
    if (!pedido) throw httpError(404, "Pedido não encontrado.");
    res.status(200).json({ pedido });
});

router.post("/", async (req, res) => {
    const idCliente = req.body.id_cliente === undefined || req.body.id_cliente === null
        ? null
        : numericId(req.body.id_cliente, "id_cliente");
    if (req.body.itens !== undefined && !Array.isArray(req.body.itens)) {
        throw httpError(400, "itens deve ser uma lista.");
    }
    if (req.body.status !== undefined && ![0, 1].includes(Number(req.body.status))) {
        throw httpError(400, "status deve ser 0 ou 1.");
    }
    const result = await transaction(async (conn) => {
        if (idCliente !== null) {
            const [cliente] = await query(conn, "SELECT id_cliente FROM clientes WHERE id_cliente = ?", [idCliente]);
            if (!cliente) throw httpError(404, "Cliente não encontrado.");
        }
        const pedidoResult = await query(conn,
            "INSERT INTO pedidos (status, data_pedido, id_cliente) VALUES (?, COALESCE(?, CURDATE()), ?)",
            [req.body.status === undefined ? 1 : Number(req.body.status), req.body.data_pedido || null, idCliente]
        );
        const itemIds = [];
        for (const item of req.body.itens || []) {
            itemIds.push(await addItem(conn, pedidoResult.insertId, item));
        }
        return { id_pedido: pedidoResult.insertId, itens: itemIds };
    });
    res.status(201).json({ mensagem: "Pedido criado com sucesso.", ...result });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const fields = [];
    const values = [];
    if (req.body.status !== undefined) {
        const status = Number(req.body.status);
        if (![0, 1].includes(status)) throw httpError(400, "status deve ser 0 ou 1.");
        fields.push("status = ?");
        values.push(status);
    }
    if (req.body.data_pedido !== undefined) {
        fields.push("data_pedido = ?");
        values.push(req.body.data_pedido);
    }
    if (req.body.id_cliente !== undefined) {
        const idCliente = req.body.id_cliente === null ? null : numericId(req.body.id_cliente, "id_cliente");
        if (idCliente !== null) {
            const [cliente] = await withConnection((conn) =>
                query(conn, "SELECT id_cliente FROM clientes WHERE id_cliente = ?", [idCliente])
            );
            if (!cliente) throw httpError(404, "Cliente não encontrado.");
        }
        fields.push("id_cliente = ?");
        values.push(idCliente);
    }
    if (!fields.length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    values.push(id);
    const result = await withConnection((conn) =>
        query(conn, `UPDATE pedidos SET ${fields.join(", ")} WHERE id_pedido = ?`, values)
    );
    if (!result.affectedRows) {
        const [pedido] = await withConnection((conn) =>
            query(conn, "SELECT id_pedido FROM pedidos WHERE id_pedido = ?", [id])
        );
        if (!pedido) throw httpError(404, "Pedido não encontrado.");
    }
    res.status(200).json({ mensagem: "Pedido atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const deleted = await transaction(async (conn) => {
        await query(conn, "DELETE FROM pedido_itens WHERE id_pedido = ?", [id]);
        return query(conn, "DELETE FROM pedidos WHERE id_pedido = ?", [id]);
    });
    if (!deleted.affectedRows) throw httpError(404, "Pedido não encontrado.");
    res.status(200).json({ mensagem: "Pedido e seus itens removidos com sucesso." });
});

router.get("/:id/itens", async (req, res) => {
    const id = numericId(req.params.id);
    const itens = await withConnection(async (conn) => {
        const [pedido] = await query(conn, "SELECT id_pedido FROM pedidos WHERE id_pedido = ?", [id]);
        if (!pedido) throw httpError(404, "Pedido não encontrado.");
        return query(conn,
            "SELECT i.*, p.nome AS produto FROM pedido_itens i LEFT JOIN produtos p ON p.id_produto = i.id_produto WHERE i.id_pedido = ? ORDER BY i.id_item",
            [id]
        );
    });
    res.status(200).json({ itens });
});

router.post("/:id/itens", async (req, res) => {
    const id = numericId(req.params.id);
    const idItem = await transaction(async (conn) => {
        const [pedido] = await query(conn, "SELECT id_pedido FROM pedidos WHERE id_pedido = ? FOR UPDATE", [id]);
        if (!pedido) throw httpError(404, "Pedido não encontrado.");
        return addItem(conn, id, req.body);
    });
    res.status(201).json({ mensagem: "Item adicionado ao pedido.", id_item: idItem });
});

router.patch("/:id/itens/:idItem", async (req, res) => {
    const idPedido = numericId(req.params.id);
    const idItem = numericId(req.params.idItem, "idItem");
    const quantidade = positiveInteger(req.body.quantidade, "quantidade");
    const result = await withConnection((conn) =>
        query(conn, "UPDATE pedido_itens SET quantidade = ?, subtotal = ROUND(? * valor_unitario, 2) WHERE id_pedido = ? AND id_item = ?", [quantidade, quantidade, idPedido, idItem])
    );
    if (!result.affectedRows) {
        const [item] = await withConnection((conn) =>
            query(conn, "SELECT id_item FROM pedido_itens WHERE id_pedido = ? AND id_item = ?", [idPedido, idItem])
        );
        if (!item) throw httpError(404, "Item não encontrado neste pedido.");
    }
    res.status(200).json({ mensagem: "Item atualizado com sucesso." });
});

router.delete("/:id/itens/:idItem", async (req, res) => {
    const idPedido = numericId(req.params.id);
    const idItem = numericId(req.params.idItem, "idItem");
    const result = await withConnection((conn) =>
        query(conn, "DELETE FROM pedido_itens WHERE id_pedido = ? AND id_item = ?", [idPedido, idItem])
    );
    if (!result.affectedRows) throw httpError(404, "Item não encontrado neste pedido.");
    res.status(200).json({ mensagem: "Item removido do pedido." });
});

module.exports = router;
