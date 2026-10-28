const express = require("express");
const router = express.Router();
const { query, withConnection, transaction, httpError, numericId, requiredText } = require("./db");

function validPrice(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) throw httpError(400, "preco deve ser um número maior ou igual a zero.");
    return price;
}

router.get("/", async (req, res) => {
    const products = await withConnection((conn) =>
        query(conn, "SELECT * FROM produtos ORDER BY id_produto DESC")
    );
    res.status(200).json({ Produtos: products });
});

router.get("/:id/historico-precos", async (req, res) => {
    const idProduto = numericId(req.params.id);
    const historico = await withConnection((conn) =>
        query(conn, "SELECT * FROM historico_precos WHERE id_produto = ? ORDER BY vigencia DESC, id_historico DESC", [idProduto])
    );
    res.status(200).json({ historico });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [produto] = await withConnection((conn) =>
        query(conn, "SELECT * FROM produtos WHERE id_produto = ?", [id])
    );
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

    const result = await transaction(async (conn) => {
        const inserted = await query(conn,
            "INSERT INTO produtos (nome, descricao, preco, imagem_produto, id_categoria) VALUES (?, ?, ?, ?, ?)",
            [nome, descricao, preco, imagem, idCategoria]
        );
        await query(conn,
            "INSERT INTO historico_precos (id_produto, preco, vigencia) VALUES (?, ?, CURDATE())",
            [inserted.insertId, preco]
        );
        return inserted;
    });
    res.status(201).json({ mensagem: "Produto criado com sucesso.", id_produto: result.insertId });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const fields = [];
    const values = [];
    const changes = [
        ["nome", (value) => requiredText(value, "nome", 100)],
        ["descricao", (value) => requiredText(value, "descricao", 200)],
        ["imagem_produto", (value) => requiredText(value, "imagem_produto", 255)],
        ["id_categoria", (value) => value === null ? null : numericId(value, "id_categoria")]
    ];
    for (const [field, validate] of changes) {
        if (req.body[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(validate(req.body[field]));
        }
    }
    let newPrice;
    if (req.body.preco !== undefined) {
        newPrice = validPrice(req.body.preco);
        fields.push("preco = ?");
        values.push(newPrice);
    }
    if (!fields.length) throw httpError(400, "Informe ao menos um campo para atualizar.");

    await transaction(async (conn) => {
        const [produto] = await query(conn, "SELECT preco FROM produtos WHERE id_produto = ? FOR UPDATE", [id]);
        if (!produto) throw httpError(404, "Produto não encontrado.");
        values.push(id);
        await query(conn, `UPDATE produtos SET ${fields.join(", ")} WHERE id_produto = ?`, values);
        if (newPrice !== undefined && Number(produto.preco) !== newPrice) {
            await query(conn,
                "INSERT INTO historico_precos (id_produto, preco, vigencia) VALUES (?, ?, CURDATE())",
                [id, newPrice]
            );
        }
    });
    res.status(200).json({ mensagem: "Produto atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const result = await withConnection((conn) =>
        query(conn, "DELETE FROM produtos WHERE id_produto = ?", [id])
    );
    if (!result.affectedRows) throw httpError(404, "Produto não encontrado.");
    res.status(200).json({ mensagem: "Produto removido com sucesso." });
});

module.exports = router;
