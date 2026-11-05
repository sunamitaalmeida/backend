const express = require("express");
const router = express.Router();
const { httpError, numericId, requiredText, models } = require("./db");
const { Categoria } = models;

router.get("/", async (req, res) => {
    const categorias = await Categoria.findAll({ order: [["id_categoria", "ASC"]] });
    res.status(200).json({ categorias });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const categoria = await Categoria.findByPk(id);
    if (!categoria) throw httpError(404, "Categoria não encontrada.");
    res.status(200).json({ categoria });
});

router.post("/", async (req, res) => {
    const nome = requiredText(req.body.nome, "nome", 100);
    const descricao = req.body.descricao === undefined ? null : req.body.descricao;
    const ativo = req.body.ativo === undefined ? 1 : Number(req.body.ativo);
    if (![0, 1].includes(ativo)) throw httpError(400, "ativo deve ser 0 ou 1.");

    const categoria = await Categoria.create({ nome, descricao, ativo });
    res.status(201).json({ mensagem: "Categoria criada com sucesso.", id_categoria: categoria.id_categoria });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const values = {};
    if (req.body.nome !== undefined) {
        values.nome = requiredText(req.body.nome, "nome", 100);
    }
    if (req.body.descricao !== undefined) {
        values.descricao = req.body.descricao;
    }
    if (req.body.ativo !== undefined) {
        const ativo = Number(req.body.ativo);
        if (![0, 1].includes(ativo)) throw httpError(400, "ativo deve ser 0 ou 1.");
        values.ativo = ativo;
    }
    if (!Object.keys(values).length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    const [updated] = await Categoria.update(values, { where: { id_categoria: id } });
    if (!updated && !(await Categoria.findByPk(id))) throw httpError(404, "Categoria não encontrada.");
    res.status(200).json({ mensagem: "Categoria atualizada com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const deleted = await Categoria.destroy({ where: { id_categoria: id } });
    if (!deleted) throw httpError(404, "Categoria não encontrada.");
    res.status(200).json({ mensagem: "Categoria removida com sucesso." });
});

module.exports = router;
