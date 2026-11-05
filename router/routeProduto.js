const express = require("express");
const router = express.Router();
const { transaction, httpError, numericId, requiredText, models } = require("./db");
const { sequelize } = require("../mysql");
const { Produto, HistoricoPreco } = models;

function validPrice(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) throw httpError(400, "preco deve ser um número maior ou igual a zero.");
    return price;
}

router.get("/", async (req, res) => {
    const products = await Produto.findAll({ order: [["id_produto", "DESC"]] });
    res.status(200).json({ Produtos: products });
});

router.get("/:id/historico-precos", async (req, res) => {
    const idProduto = numericId(req.params.id);
    const historico = await HistoricoPreco.findAll({
        where: { id_produto: idProduto },
        order: [["vigencia", "DESC"], ["id_historico", "DESC"]]
    });
    res.status(200).json({ historico });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const produto = await Produto.findByPk(id);
    if (!produto) throw httpError(404, "Produto não encontrado.");
    res.status(200).json({ Produtos: produto });
});

router.post("/", async (req, res) => {
    const nome = requiredText(req.body.nome, "nome", 100);
    const descricao = requiredText(req.body.descricao, "descricao", 200);
    const preco = validPrice(req.body.preco);
    const imagem = requiredText(req.body.imagem_produto, "imagem_produto", 255);
    const idCategoria = req.body.id_categoria === undefined || req.body.id_categoria === null
        ? null
        : numericId(req.body.id_categoria, "id_categoria");

    const result = await transaction(async ({ transaction: dbTransaction }) => {
        const inserted = await Produto.create({
            nome,
            descricao,
            preco,
            imagem_produto: imagem,
            id_categoria: idCategoria
        }, { transaction: dbTransaction });
        await HistoricoPreco.create({
            id_produto: inserted.id_produto,
            preco,
            vigencia: sequelize.literal("CURDATE()")
        }, { transaction: dbTransaction });
        return inserted;
    });
    res.status(201).json({ mensagem: "Produto criado com sucesso.", id_produto: result.id_produto });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const changes = [
        ["nome", (value) => requiredText(value, "nome", 100)],
        ["descricao", (value) => requiredText(value, "descricao", 200)],
        ["imagem_produto", (value) => requiredText(value, "imagem_produto", 255)],
        ["id_categoria", (value) => value === null ? null : numericId(value, "id_categoria")]
    ];
    const updates = {};
    for (const [field, validate] of changes) {
        if (req.body[field] !== undefined) {
            updates[field] = validate(req.body[field]);
        }
    }
    let newPrice;
    if (req.body.preco !== undefined) {
        newPrice = validPrice(req.body.preco);
        updates.preco = newPrice;
    }
    if (!Object.keys(updates).length) {
        throw httpError(400, "Informe ao menos um campo para atualizar.");
    }

    await transaction(async ({ transaction: dbTransaction }) => {
        const produto = await Produto.findByPk(id, { transaction: dbTransaction, lock: true });
        if (!produto) throw httpError(404, "Produto não encontrado.");
        const previousPrice = Number(produto.preco);
        await produto.update(updates, { transaction: dbTransaction });
        if (newPrice !== undefined && previousPrice !== newPrice) {
            await HistoricoPreco.create({
                id_produto: id,
                preco: newPrice,
                vigencia: sequelize.literal("CURDATE()")
            }, { transaction: dbTransaction });
        }
    });
    res.status(200).json({ mensagem: "Produto atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const deleted = await Produto.destroy({ where: { id_produto: id } });
    if (!deleted) throw httpError(404, "Produto não encontrado.");
    res.status(200).json({ mensagem: "Produto removido com sucesso." });
});

module.exports = router;
