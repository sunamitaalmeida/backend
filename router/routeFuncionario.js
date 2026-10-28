const express = require("express");
const router = express.Router();
const { query, withConnection, httpError, numericId, requiredText } = require("./db");

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
    const funcionarios = await withConnection((conn) => query(conn, "SELECT * FROM funcionarios ORDER BY id_funcionario DESC"));
    res.status(200).json({ funcionario: funcionarios });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [funcionario] = await withConnection((conn) => query(conn, "SELECT * FROM funcionarios WHERE id_funcionario = ?", [id]));
    if (!funcionario) throw httpError(404, "Funcionário não encontrado.");
    res.status(200).json({ funcionario });
});

router.post("/", async (req, res) => {
    const nome = requiredText(req.body.nome, "nome", 100);
    const cargo = requiredText(req.body.cargo, "cargo", 50);
    const salarioValue = salary(req.body.salario);
    const ativo = req.body.ativo === undefined ? 1 : activeFlag(req.body.ativo);
    const result = await withConnection((conn) => query(conn,
        "INSERT INTO funcionarios (nome, cargo, salario, telefone, email, data_admissao, ativo) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [nome, cargo, salarioValue, req.body.telefone || null, req.body.email || null, req.body.data_admissao || null, ativo]
    ));
    res.status(201).json({ mensagem: "Funcionário criado com sucesso.", id_funcionario: result.insertId });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const fields = [];
    const values = [];
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
            fields.push(`${field} = ?`);
            values.push(validate(req.body[field]));
        }
    }
    if (!fields.length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    values.push(id);
    const result = await withConnection((conn) => query(conn,
        `UPDATE funcionarios SET ${fields.join(", ")} WHERE id_funcionario = ?`, values
    ));
    if (!result.affectedRows) {
        const [funcionario] = await withConnection((conn) => query(conn, "SELECT id_funcionario FROM funcionarios WHERE id_funcionario = ?", [id]));
        if (!funcionario) throw httpError(404, "Funcionário não encontrado.");
    }
    res.status(200).json({ mensagem: "Funcionário atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const result = await withConnection((conn) => query(conn, "DELETE FROM funcionarios WHERE id_funcionario = ?", [id]));
    if (!result.affectedRows) throw httpError(404, "Funcionário não encontrado.");
    res.status(200).json({ mensagem: "Funcionário removido com sucesso." });
});

module.exports = router;
