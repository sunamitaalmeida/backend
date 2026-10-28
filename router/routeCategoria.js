const express = require("express");
const router = express.Router();
const { query, withConnection, httpError, numericId, requiredText } = require("./db");

router.get("/", async (req, res) => {
    const categorias = await withConnection((conn) =>
        query(conn, "SELECT * FROM categorias ORDER BY id_categoria")
    );
    res.status(200).json({ categorias });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [categoria] = await withConnection((conn) =>
        query(conn, "SELECT * FROM categorias WHERE id_categoria = ?", [id])
    );
    if (!categoria) throw httpError(404, "Categoria não encontrada.");
    res.status(200).json({ categoria });
});

router.post("/", async (req, res) => {
    const nome = requiredText(req.body.nome, "nome", 100);
    const descricao = req.body.descricao === undefined ? null : req.body.descricao;
    const ativo = req.body.ativo === undefined ? 1 : Number(req.body.ativo);
    if (![0, 1].includes(ativo)) throw httpError(400, "ativo deve ser 0 ou 1.");

    const result = await withConnection((conn) =>
        query(conn, "INSERT INTO categorias (nome, descricao, ativo) VALUES (?, ?, ?)", [nome, descricao, ativo])
    );
    res.status(201).json({ mensagem: "Categoria criada com sucesso.", id_categoria: result.insertId });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const fields = [];
    const values = [];
    if (req.body.nome !== undefined) {
        fields.push("nome = ?");
        values.push(requiredText(req.body.nome, "nome", 100));
    }
    if (req.body.descricao !== undefined) {
        fields.push("descricao = ?");
        values.push(req.body.descricao);
    }
    if (req.body.ativo !== undefined) {
        const ativo = Number(req.body.ativo);
        if (![0, 1].includes(ativo)) throw httpError(400, "ativo deve ser 0 ou 1.");
        fields.push("ativo = ?");
        values.push(ativo);
    }
    if (!fields.length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    values.push(id);
    const result = await withConnection((conn) =>
        query(conn, `UPDATE categorias SET ${fields.join(", ")} WHERE id_categoria = ?`, values)
    );
    if (!result.affectedRows) {
        const [categoria] = await withConnection((conn) =>
            query(conn, "SELECT id_categoria FROM categorias WHERE id_categoria = ?", [id])
        );
        if (!categoria) throw httpError(404, "Categoria não encontrada.");
    }
    res.status(200).json({ mensagem: "Categoria atualizada com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const result = await withConnection((conn) =>
        query(conn, "DELETE FROM categorias WHERE id_categoria = ?", [id])
    );
    if (!result.affectedRows) throw httpError(404, "Categoria não encontrada.");
    res.status(200).json({ mensagem: "Categoria removida com sucesso." });
});

module.exports = router;
