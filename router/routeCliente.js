const express = require("express");
const router = express.Router();
const { httpError, numericId, requiredText, models } = require("./db");
const { Cliente } = models;

function activeFlag(value) {
    const active = Number(value);
    if (![0, 1].includes(active)) throw httpError(400, "ativo deve ser 0 ou 1.");
    return active;
}

router.get("/", async (req, res) => {
    const clientes = await Cliente.findAll({ order: [["id_cliente", "DESC"]] });
    res.status(200).json({ Cliente: clientes });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const cliente = await Cliente.findByPk(id);
    if (!cliente) throw httpError(404, "Cliente não encontrado.");
    res.status(200).json({ Cliente: cliente });
});

router.post("/", async (req, res) => {
    const nome = requiredText(req.body.nome, "nome", 100);
    const email = requiredText(req.body.email, "email", 100);
    const contato = req.body.contato === undefined ? null : req.body.contato;
    const ativo = req.body.ativo === undefined ? 1 : activeFlag(req.body.ativo);
    const cliente = await Cliente.create({ nome, email, contato, ativo });
    res.status(201).json({ mensagem: "Cliente criado com sucesso.", id_cliente: cliente.id_cliente });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const values = {};
    for (const [field, validate] of [
        ["nome", (value) => requiredText(value, "nome", 100)],
        ["email", (value) => requiredText(value, "email", 100)],
        ["contato", (value) => value],
        ["ativo", activeFlag]
    ]) {
        if (req.body[field] !== undefined) {
            values[field] = validate(req.body[field]);
        }
    }
    if (!Object.keys(values).length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    const [updated] = await Cliente.update(values, { where: { id_cliente: id } });
    if (!updated && !(await Cliente.findByPk(id))) throw httpError(404, "Cliente não encontrado.");
    res.status(200).json({ mensagem: "Cliente atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const deleted = await Cliente.destroy({ where: { id_cliente: id } });
    if (!deleted) throw httpError(404, "Cliente não encontrado.");
    res.status(200).json({ mensagem: "Cliente removido com sucesso." });
});

module.exports = router;
