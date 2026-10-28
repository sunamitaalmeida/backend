const express = require("express");
const router = express.Router();
const { query, withConnection, httpError, numericId, requiredText } = require("./db");

function activeFlag(value) {
    const active = Number(value);
    if (![0, 1].includes(active)) throw httpError(400, "ativo deve ser 0 ou 1.");
    return active;
}

router.get("/", async (req, res) => {
    const fornecedores = await withConnection((conn) => query(conn, "SELECT * FROM fornecedores ORDER BY id_fornecedor DESC"));
    res.status(200).json({ fornecedor: fornecedores });
});

router.get("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const [fornecedor] = await withConnection((conn) => query(conn, "SELECT * FROM fornecedores WHERE id_fornecedor = ?", [id]));
    if (!fornecedor) throw httpError(404, "Fornecedor não encontrado.");
    res.status(200).json({ fornecedor });
});

router.post("/", async (req, res) => {
    const nome = requiredText(req.body.nome, "nome", 100);
    const ativo = req.body.ativo === undefined ? 1 : activeFlag(req.body.ativo);
    const values = [nome, req.body.empresa || null, req.body.email || null, req.body.telefone || null, req.body.cidade || null, req.body.estado || null, ativo];
    const result = await withConnection((conn) => query(conn,
        "INSERT INTO fornecedores (nome, empresa, email, telefone, cidade, estado, ativo) VALUES (?, ?, ?, ?, ?, ?, ?)", values
    ));
    res.status(201).json({ mensagem: "Fornecedor criado com sucesso.", id_fornecedor: result.insertId });
});

router.patch("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const fields = [];
    const values = [];
    const allowed = ["nome", "empresa", "email", "telefone", "cidade", "estado"];
    for (const field of allowed) {
        if (req.body[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(field === "nome" ? requiredText(req.body[field], field, 100) : req.body[field]);
        }
    }
    if (req.body.ativo !== undefined) {
        fields.push("ativo = ?");
        values.push(activeFlag(req.body.ativo));
    }
    if (!fields.length) throw httpError(400, "Informe ao menos um campo para atualizar.");
    values.push(id);
    const result = await withConnection((conn) => query(conn,
        `UPDATE fornecedores SET ${fields.join(", ")} WHERE id_fornecedor = ?`, values
    ));
    if (!result.affectedRows) {
        const [fornecedor] = await withConnection((conn) => query(conn, "SELECT id_fornecedor FROM fornecedores WHERE id_fornecedor = ?", [id]));
        if (!fornecedor) throw httpError(404, "Fornecedor não encontrado.");
    }
    res.status(200).json({ mensagem: "Fornecedor atualizado com sucesso." });
});

router.delete("/:id", async (req, res) => {
    const id = numericId(req.params.id);
    const result = await withConnection((conn) => query(conn, "DELETE FROM fornecedores WHERE id_fornecedor = ?", [id]));
    if (!result.affectedRows) throw httpError(404, "Fornecedor não encontrado.");
    res.status(200).json({ mensagem: "Fornecedor removido com sucesso." });
});

module.exports = router;
