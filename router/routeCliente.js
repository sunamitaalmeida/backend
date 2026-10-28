const express = require("express");
const router = express.Router();
const { query, withConnection, httpError, numericId, requiredText } = require("./db");

function activeFlag(value) {
    const active = Number(value);
    if (![0, 1].includes(active)) throw httpError(400, "ativo deve ser 0 ou 1.");
    return active;
}

router.get("/", async (req, res) => {
    const clientes = await withConnection((conn) => query(conn, "SELECT * FROM clientes ORDER BY id_cliente DESC"));
    res.status(200).json({ Cliente: clientes });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [cliente] = await withConnection((conn) => query(conn, "SELECT * FROM clientes WHERE id_cliente = ?", [id]));
    if (!cliente) throw httpError(404, "Cliente não encontrado.");
    res.status(200).json({ Cliente: cliente });
});

router.post("/", async (req, res) => {
    const nome = requiredText(req.body.nome, "nome", 100);
    const email = requiredText(req.body.email, "email", 100);
    const contato = req.body.contato === undefined ? null : req.body.contato;
    const ativo = req.body.ativo === undefined ? 1 : activeFlag(req.body.ativo);
    const result = await withConnection((conn) =>
        query(conn, "INSERT INTO clientes (nome, email, contato, ativo) VALUES (?, ?, ?, ?)", [nome, email, contato, ativo])
    );
    res.status(201).json({ mensagem: "Cliente criado com sucesso.", id_cliente: result.insertId });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const fields = [];
    const values = [];
    for (const [field, validate] of [
        ["nome", (value) => requiredText(value, "nome", 100)],
        ["email", (value) => requiredText(value, "email", 100)],
        ["contato", (value) => value],
        ["ativo", activeFlag]
    ]) {
        if (req.body[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(validate(req.body[field]));
        }
    }
    if (!fields.length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    values.push(id);
    const result = await withConnection((conn) => query(conn,
        `UPDATE clientes SET ${fields.join(", ")} WHERE id_cliente = ?`, values
    ));
    if (!result.affectedRows) {
        const [cliente] = await withConnection((conn) => query(conn, "SELECT id_cliente FROM clientes WHERE id_cliente = ?", [id]));
        if (!cliente) throw httpError(404, "Cliente não encontrado.");
    }
    res.status(200).json({ mensagem: "Cliente atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const result = await withConnection((conn) => query(conn, "DELETE FROM clientes WHERE id_cliente = ?", [id]));
    if (!result.affectedRows) throw httpError(404, "Cliente não encontrado.");
    res.status(200).json({ mensagem: "Cliente removido com sucesso." });
});

module.exports = router;
