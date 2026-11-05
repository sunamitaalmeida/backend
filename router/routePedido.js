const express = require("express");
const router = express.Router();
const { transaction, httpError, numericId, positiveInteger, models } = require("./db");
const { sequelize } = require("../mysql");
const { Cliente, Pedido, PedidoItem, Produto } = models;

async function addItem(connection, idPedido, item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw httpError(400, "Cada item deve ser um objeto com id_produto e quantidade.");
    }
    const idProduto = numericId(item.id_produto, "id_produto");
    const quantidade = positiveInteger(item.quantidade, "quantidade");
    const produto = await Produto.findByPk(idProduto, {
        attributes: ["id_produto", "preco"],
        transaction: connection.transaction
    });
    if (!produto) throw httpError(404, `Produto ${idProduto} não encontrado.`);
    const pedidoItem = await PedidoItem.create({
        id_pedido: idPedido,
        id_produto: idProduto,
        quantidade,
        valor_unitario: produto.preco,
        subtotal: sequelize.literal(`ROUND(${quantidade} * ${sequelize.escape(produto.preco)}, 2)`)
    }, { transaction: connection.transaction });
    return pedidoItem.id_item;
}

router.get("/", async (req, res) => {
    const where = {};
    if (req.query.id_cliente !== undefined) {
        where.id_cliente = numericId(req.query.id_cliente, "id_cliente");
    }
    if (req.query.status !== undefined) {
        const status = Number(req.query.status);
        if (![0, 1].includes(status)) throw httpError(400, "status deve ser 0 ou 1.");
        where.status = status;
    }
    const pedidos = await Pedido.findAll({
        attributes: { include: [[sequelize.col("cliente.nome"), "cliente"]] },
        include: [{ model: Cliente, as: "cliente", attributes: [], required: false }],
        where,
        order: [["id_pedido", "DESC"]],
        raw: true
    });
    res.status(200).json({ pedidos });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const pedido = await Pedido.findByPk(id);
    if (!pedido) throw httpError(404, "Pedido não encontrado.");
    const cliente = pedido.id_cliente === null
        ? null
        : await Cliente.findByPk(pedido.id_cliente, { attributes: ["nome"] });
    const itens = await PedidoItem.findAll({
        attributes: { include: [[sequelize.col("produto.nome"), "produto"]] },
        include: [{ model: Produto, as: "produto", attributes: [], required: false }],
        where: { id_pedido: id },
        order: [["id_item", "ASC"]],
        raw: true
    });
    res.status(200).json({
        pedido: {
            ...pedido.get({ plain: true }),
            cliente: cliente ? cliente.nome : null,
            itens
        }
    });
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
    const result = await transaction(async (connection) => {
        if (idCliente !== null) {
            const cliente = await Cliente.findByPk(idCliente, {
                attributes: ["id_cliente"],
                transaction: connection.transaction
            });
            if (!cliente) throw httpError(404, "Cliente não encontrado.");
        }
        const pedido = await Pedido.create({
            status: req.body.status === undefined ? 1 : Number(req.body.status),
            data_pedido: req.body.data_pedido || sequelize.literal("CURDATE()"),
            id_cliente: idCliente
        }, { transaction: connection.transaction });
        const itemIds = [];
        for (const item of req.body.itens || []) {
            itemIds.push(await addItem(connection, pedido.id_pedido, item));
        }
        return { id_pedido: pedido.id_pedido, itens: itemIds };
    });
    res.status(201).json({ mensagem: "Pedido criado com sucesso.", ...result });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const updates = {};
    if (req.body.status !== undefined) {
        const status = Number(req.body.status);
        if (![0, 1].includes(status)) throw httpError(400, "status deve ser 0 ou 1.");
        updates.status = status;
    }
    if (req.body.data_pedido !== undefined) {
        updates.data_pedido = req.body.data_pedido;
    }
    if (req.body.id_cliente !== undefined) {
        const idCliente = req.body.id_cliente === null ? null : numericId(req.body.id_cliente, "id_cliente");
        if (idCliente !== null) {
            const cliente = await Cliente.findByPk(idCliente, { attributes: ["id_cliente"] });
            if (!cliente) throw httpError(404, "Cliente não encontrado.");
        }
        updates.id_cliente = idCliente;
    }
    if (!Object.keys(updates).length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    const [updated] = await Pedido.update(updates, { where: { id_pedido: id } });
    if (!updated && !(await Pedido.findByPk(id))) throw httpError(404, "Pedido não encontrado.");
    res.status(200).json({ mensagem: "Pedido atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const deleted = await transaction(async ({ transaction: dbTransaction }) => {
        await PedidoItem.destroy({ where: { id_pedido: id }, transaction: dbTransaction });
        return Pedido.destroy({ where: { id_pedido: id }, transaction: dbTransaction });
    });
    if (!deleted) throw httpError(404, "Pedido não encontrado.");
    res.status(200).json({ mensagem: "Pedido e seus itens removidos com sucesso." });
});

router.get("/:id/itens", async (req, res) => {
    const id = numericId(req.params.id);
    const pedido = await Pedido.findByPk(id, { attributes: ["id_pedido"] });
    if (!pedido) throw httpError(404, "Pedido não encontrado.");
    const itens = await PedidoItem.findAll({
        attributes: { include: [[sequelize.col("produto.nome"), "produto"]] },
        include: [{ model: Produto, as: "produto", attributes: [], required: false }],
        where: { id_pedido: id },
        order: [["id_item", "ASC"]],
        raw: true
    });
    res.status(200).json({ itens });
});

router.post("/:id/itens", async (req, res) => {
    const id = numericId(req.params.id);
    const idItem = await transaction(async (connection) => {
        const pedido = await Pedido.findByPk(id, {
            attributes: ["id_pedido"],
            transaction: connection.transaction,
            lock: true
        });
        if (!pedido) throw httpError(404, "Pedido não encontrado.");
        return addItem(connection, id, req.body);
    });
    res.status(201).json({ mensagem: "Item adicionado ao pedido.", id_item: idItem });
});

router.patch("/:id/itens/:idItem", async (req, res) => {
    const idPedido = numericId(req.params.id);
    const idItem = numericId(req.params.idItem, "idItem");
    const quantidade = positiveInteger(req.body.quantidade, "quantidade");
    const item = await PedidoItem.findOne({ where: { id_pedido: idPedido, id_item: idItem } });
    if (!item) throw httpError(404, "Item não encontrado neste pedido.");
    await item.update({
        quantidade,
        subtotal: sequelize.literal(`ROUND(${quantidade} * valor_unitario, 2)`)
    });
    res.status(200).json({ mensagem: "Item atualizado com sucesso." });
});

router.delete("/:id/itens/:idItem", async (req, res) => {
    const idPedido = numericId(req.params.id);
    const idItem = numericId(req.params.idItem, "idItem");
    const deleted = await PedidoItem.destroy({ where: { id_pedido: idPedido, id_item: idItem } });
    if (!deleted) throw httpError(404, "Item não encontrado neste pedido.");
    res.status(200).json({ mensagem: "Item removido do pedido." });
});

module.exports = router;
