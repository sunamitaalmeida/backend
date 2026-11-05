const jwt = require("jsonwebtoken");
const { httpError, numericId, models } = require("./db");

const ROLES = ["admin", "vendas", "estoque", "consulta"];

function configuredSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
        throw httpError(500, "JWT_SECRET deve estar configurada com pelo menos 32 bytes.");
    }
    return secret;
}

function createAccessToken(user) {
    return jwt.sign(
        { sub: String(user.id_usu) },
        configuredSecret(),
        { algorithm: "HS256", expiresIn: "1h" }
    );
}

async function authenticate(req, res, next) {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        throw httpError(401, "Token de autenticação ausente.");
    }

    let payload;
    try {
        payload = jwt.verify(match[1], configuredSecret(), { algorithms: ["HS256"] });
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            throw httpError(401, "Token de autenticação inválido ou expirado.");
        }
        throw error;
    }

    let id;
    try {
        id = numericId(payload.sub, "sub");
    } catch {
        throw httpError(401, "Token de autenticação inválido.");
    }

    const user = await models.Usuario.findByPk(id, { attributes: ["id_usu", "ativo", "papel"] });
    if (!user || Number(user.ativo) !== 1) {
        throw httpError(401, "Usuário inválido ou inativo.");
    }

    req.auth = { userId: id, role: user.papel };
    next();
}

function authorizeRoles({ roles = [], readOnlyRoles = [] } = {}) {
    return (req, res, next) => {
        const role = req.auth.role;
        const permitted = roles.includes(role)
            || (req.method === "GET" && readOnlyRoles.includes(role));
        if (!permitted) {
            throw httpError(403, "Seu papel não permite esta operação.");
        }
        next();
    };
}

module.exports = { authenticate, authorizeRoles, createAccessToken, configuredSecret, ROLES };
