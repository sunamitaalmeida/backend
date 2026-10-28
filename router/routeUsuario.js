const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const { query, withConnection, httpError, requiredText } = require("./db");
const { createCrudRouter, activeFlag } = require("./crudRouter");

async function loginUsuario(req, res) {
    const email = requiredText(req.body.email, "email", 100).toLowerCase();
    const senha = requiredText(req.body.senha, "senha", 255);

    const [usuario] = await withConnection((conn) =>
        query(conn, "SELECT id_usu, nome, email, contato, genero, ativo, senha_hash FROM usuarios WHERE email = ? LIMIT 1", [email])
    );

    if (!usuario) {
        throw httpError(401, "Credenciais inválidas.");
    }

    const senhaValida = usuario.senha_hash && (
        usuario.senha_hash.startsWith("$2")
            ? bcrypt.compareSync(senha, usuario.senha_hash)
            : usuario.senha_hash === senha
    );

    if (!senhaValida) {
        throw httpError(401, "Credenciais inválidas.");
    }

    const { senha_hash, ...usuarioSemSenha } = usuario;
    res.status(200).json({
        mensagem: "Login realizado com sucesso.",
        usuario: usuarioSemSenha
    });
}

const usuarioCrud = createCrudRouter({
    tableName: "usuarios",
    idColumn: "id_usu",
    resourceName: "Usuario",
    listSelect: "id_usu, nome, email, contato, genero, ativo, criado_em, atualizado_em",
    fields: [
        { key: "nome", validate: (value) => requiredText(value, "nome", 80) },
        { key: "email", validate: (value) => requiredText(value, "email", 100).toLowerCase() },
        { key: "senha_hash", validate: (value) => requiredText(value, "senha_hash", 255), insert: true, update: false },
        { key: "contato", transform: (value) => value === undefined || value === null || value === "" ? null : value },
        { key: "genero", transform: (value) => value === undefined || value === null || value === "" ? null : value },
        { key: "ativo", validate: activeFlag, default: 1 }
    ]
});

router.use("/", usuarioCrud);
router.post("/login", loginUsuario);

module.exports = router;
module.exports.loginUsuario = loginUsuario;
