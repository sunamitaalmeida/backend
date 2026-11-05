const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const { httpError, numericId, requiredText, models } = require("./db");
const { createCrudRouter, activeFlag } = require("./crudRouter");
const { createAccessToken, ROLES } = require("./auth");

async function loginUsuario(req, res) {
    const email = requiredText(req.body.email, "email", 100).toLowerCase();
    const senha = requiredText(req.body.senha, "senha", 255);

    const usuario = await models.Usuario.findOne({
        attributes: ["id_usu", "nome", "email", "contato", "genero", "papel", "ativo", "senha_hash"],
        where: { email }
    });

    if (!usuario) {
        throw httpError(401, "Credenciais inválidas.");
    }

    const senhaHash = usuario.get("senha_hash");
    const senhaValida = senhaHash && (
        senhaHash.startsWith("$2")
            ? await bcrypt.compare(senha, senhaHash)
            : senhaHash === senha
    );

    if (!senhaValida || Number(usuario.get("ativo")) !== 1) {
        throw httpError(401, "Credenciais inválidas.");
    }

    if (!senhaHash.startsWith("$2")) {
        await usuario.update({ senha_hash: await bcrypt.hash(senha, 10) });
    }

    const usuarioSemSenha = usuario.get({ plain: true });
    delete usuarioSemSenha.senha_hash;
    res.status(200).json({
        mensagem: "Login realizado com sucesso.",
        usuario: usuarioSemSenha,
        token: createAccessToken(usuario)
    });
}

const usuarioCrud = createCrudRouter({
    tableName: "usuarios",
    model: models.Usuario,
    idColumn: "id_usu",
    resourceName: "Usuario",
    listSelect: "id_usu, nome, email, contato, genero, papel, ativo, criado_em, atualizado_em",
    fields: [
        { key: "nome", validate: (value) => requiredText(value, "nome", 80) },
        { key: "email", validate: (value) => requiredText(value, "email", 100).toLowerCase() },
        { key: "senha_hash", validate: (value) => requiredText(value, "senha_hash", 255), insert: true, update: false },
        { key: "papel", insert: false, update: false },
        { key: "contato", transform: (value) => value === undefined || value === null || value === "" ? null : value },
        { key: "genero", transform: (value) => value === undefined || value === null || value === "" ? null : value },
        { key: "ativo", validate: activeFlag, default: 1 }
    ]
});

router.use("/", usuarioCrud);
router.patch("/:id/papel", async (req, res) => {
    const id = numericId(req.params.id);
    if (!ROLES.includes(req.body.papel)) {
        throw httpError(400, `papel deve ser um destes valores: ${ROLES.join(", ")}.`);
    }
    const user = await models.Usuario.findByPk(id);
    if (!user) throw httpError(404, "Usuário não encontrado.");
    await user.update({ papel: req.body.papel });
    res.status(200).json({ mensagem: "Papel do usuário atualizado.", id_usu: id, papel: user.papel });
});

module.exports = router;
module.exports.loginUsuario = loginUsuario;
