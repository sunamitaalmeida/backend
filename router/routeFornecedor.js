const express = require("express");
const router = express.Router();
const { httpError, numericId, requiredText, models } = require("./db");
const { Fornecedor } = models;

function activeFlag(value) {
    const active = Number(value);
    if (![0, 1].includes(active)) throw httpError(400, "ativo deve ser 0 ou 1.");
    return active;
}

router.get("/", async (req, res) => {
    const fornecedores = await Fornecedor.findAll({ order: [["id_fornecedor", "DESC"]] });
    res.status(200).json({ fornecedor: fornecedores });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const fornecedor = await Fornecedor.findByPk(id);
    if (!fornecedor) throw httpError(404, "Fornecedor não encontrado.");
    res.status(200).json({ fornecedor });
});

router.post("/", async (req, res) => {
    const nome = requiredText(req.body.nome, "nome", 100);
    const ativo = req.body.ativo === undefined ? 1 : activeFlag(req.body.ativo);
    const fornecedor = await Fornecedor.create({
        nome,
        empresa: req.body.empresa || null,
        email: req.body.email || null,
        telefone: req.body.telefone || null,
        cidade: req.body.cidade || null,
        estado: req.body.estado || null,
        ativo
    });
    res.status(201).json({ mensagem: "Fornecedor criado com sucesso.", id_fornecedor: fornecedor.id_fornecedor });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const updateValues = {};
    const allowed = ["nome", "empresa", "email", "telefone", "cidade", "estado"];
    for (const field of allowed) {
        if (req.body[field] !== undefined) {
            updateValues[field] = field === "nome" ? requiredText(req.body[field], field, 100) : req.body[field];
        }
    }
    if (req.body.ativo !== undefined) {
        updateValues.ativo = activeFlag(req.body.ativo);
    }
    if (!Object.keys(updateValues).length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    const [updated] = await Fornecedor.update(updateValues, { where: { id_fornecedor: id } });
    if (!updated && !(await Fornecedor.findByPk(id))) throw httpError(404, "Fornecedor não encontrado.");
    res.status(200).json({ mensagem: "Fornecedor atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const deleted = await Fornecedor.destroy({ where: { id_fornecedor: id } });
    if (!deleted) throw httpError(404, "Fornecedor não encontrado.");
    res.status(200).json({ mensagem: "Fornecedor removido com sucesso." });
});

module.exports = router;
