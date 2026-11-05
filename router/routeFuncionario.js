const express = require("express");
const router = express.Router();
const { httpError, numericId, requiredText, models } = require("./db");
const { Funcionario } = models;

function activeFlag(value) {
    const active = Number(value);
    if (![0, 1].includes(active)) throw httpError(400, "ativo deve ser 0 ou 1.");
    return active;
}

function salary(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw httpError(400, "salario deve ser um número maior ou igual a zero.");
    return amount;
}

router.get("/", async (req, res) => {
    const funcionarios = await Funcionario.findAll({ order: [["id_funcionario", "DESC"]] });
    res.status(200).json({ funcionario: funcionarios });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const funcionario = await Funcionario.findByPk(id);
    if (!funcionario) throw httpError(404, "Funcionário não encontrado.");
    res.status(200).json({ funcionario });
});

router.post("/", async (req, res) => {
    const nome = requiredText(req.body.nome, "nome", 100);
    const cargo = requiredText(req.body.cargo, "cargo", 50);
    const salarioValue = salary(req.body.salario);
    const ativo = req.body.ativo === undefined ? 1 : activeFlag(req.body.ativo);
    const funcionario = await Funcionario.create({
        nome,
        cargo,
        salario: salarioValue,
        telefone: req.body.telefone || null,
        email: req.body.email || null,
        data_admissao: req.body.data_admissao || null,
        ativo
    });
    res.status(201).json({ mensagem: "Funcionário criado com sucesso.", id_funcionario: funcionario.id_funcionario });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const values = {};
    const validators = {
        nome: (value) => requiredText(value, "nome", 100),
        cargo: (value) => requiredText(value, "cargo", 50),
        salario: salary,
        telefone: (value) => value,
        email: (value) => value,
        data_admissao: (value) => value,
        ativo: activeFlag
    };
    for (const [field, validate] of Object.entries(validators)) {
        if (req.body[field] !== undefined) {
            values[field] = validate(req.body[field]);
        }
    }
    if (!Object.keys(values).length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    const [updated] = await Funcionario.update(values, { where: { id_funcionario: id } });
    if (!updated && !(await Funcionario.findByPk(id))) throw httpError(404, "Funcionário não encontrado.");
    res.status(200).json({ mensagem: "Funcionário atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const deleted = await Funcionario.destroy({ where: { id_funcionario: id } });
    if (!deleted) throw httpError(404, "Funcionário não encontrado.");
    res.status(200).json({ mensagem: "Funcionário removido com sucesso." });
});

module.exports = router;
