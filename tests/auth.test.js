const { randomBytes, randomUUID } = require("node:crypto");
const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
    process.env.JWT_SECRET = randomBytes(32).toString("hex");
}

const app = require("../app");
const { sequelize, models } = require("../mysql");

let server;
let baseUrl;
let testUser;
let testPassword;
let accessToken;
const extraUsers = [];

before(async () => {
    await sequelize.authenticate();
    testPassword = randomBytes(24).toString("base64url");
    testUser = await models.Usuario.create({
        nome: "Usuário temporário de teste",
        email: `test-auth-${randomUUID()}@example.invalid`,
        senha_hash: await bcrypt.hash(testPassword, 10),
        papel: "admin",
        ativo: 1
    });

    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    try {
        if (testUser) {
            await testUser.destroy();
        }
        await Promise.all(extraUsers.map((user) => user.destroy()));
    } finally {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        await sequelize.close();
    }
});

async function postJson(path, body) {
    return fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

test("health and login endpoints are public", async () => {
    const health = await fetch(`${baseUrl}/teste`);
    assert.equal(health.status, 200);

    const login = await postJson("/login", {
        email: testUser.email,
        senha: testPassword
    });
    const body = await login.json();
    assert.equal(login.status, 200);
    assert.equal(body.mensagem, "Login realizado com sucesso.");
    assert.equal(body.usuario.id_usu, testUser.id_usu);
    assert.equal(Object.hasOwn(body.usuario, "senha_hash"), false);
    assert.equal(typeof body.token, "string");
    accessToken = body.token;

    const alternateLogin = await postJson("/usuario/login", {
        email: testUser.email,
        senha: testPassword
    });
    assert.equal(alternateLogin.status, 200);
    assert.equal(typeof (await alternateLogin.json()).token, "string");
});

test("CORS preflight for login does not require authentication", async () => {
    const configuredOrigins = (process.env.CORS_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean);
    const origin = configuredOrigins.find((value) => value !== "*") || "http://localhost:3000";
    const expectedOrigin = (configuredOrigins.length === 1 && configuredOrigins[0] === "*")
        || (!configuredOrigins.length && process.env.NODE_ENV !== "production")
        ? "*"
        : origin;
    const response = await fetch(`${baseUrl}/login`, {
        method: "OPTIONS",
        headers: {
            Origin: origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), expectedOrigin);
});

test("the alternate login route rejects invalid credentials", async () => {
    const response = await postJson("/usuario/login", {
        email: testUser.email,
        senha: `${testPassword}-invalid`
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.erro.mensagem, "Credenciais inválidas.");
});

test("successful legacy login upgrades the stored password to bcrypt", async () => {
    const password = `legacy-${randomUUID()}`;
    const user = await models.Usuario.create({
        nome: "Usuário legado temporário",
        email: `test-legacy-${randomUUID()}@example.invalid`,
        senha_hash: password,
        ativo: 1
    });

    try {
        const response = await postJson("/login", { email: user.email, senha: password });
        assert.equal(response.status, 200);
        const upgraded = await models.Usuario.findByPk(user.id_usu);
        assert.match(upgraded.senha_hash, /^\$2/);
        assert.equal(await bcrypt.compare(password, upgraded.senha_hash), true);
    } finally {
        await user.destroy();
    }
});

test("data routes and user registration require a bearer token", async () => {
    const list = await fetch(`${baseUrl}/cliente`);
    assert.equal(list.status, 401);

    const registration = await postJson("/usuario", {
        nome: "Cadastro não autorizado",
        email: `unauthorized-${randomUUID()}@example.invalid`,
        senha_hash: await bcrypt.hash(randomBytes(24).toString("base64url"), 10)
    });
    assert.equal(registration.status, 401);
});

test("user role changes are restricted to administrators", async () => {
    const target = await models.Usuario.create({
        nome: "Usuário alvo de alteração",
        email: `test-role-target-${randomUUID()}@example.invalid`,
        senha_hash: await bcrypt.hash(randomBytes(24).toString("base64url"), 10),
        papel: "consulta",
        ativo: 1
    });
    extraUsers.push(target);

    const response = await fetch(`${baseUrl}/usuario/${target.id_usu}/papel`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ papel: "vendas" })
    });
    assert.equal(response.status, 200);

    const invalidRole = await fetch(`${baseUrl}/usuario/${target.id_usu}/papel`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ papel: "superadmin" })
    });
    assert.equal(invalidRole.status, 400);
});

test("a valid bearer token authorizes data routes", async () => {
    assert.ok(accessToken);
    const list = await fetch(`${baseUrl}/cliente`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    assert.equal(list.status, 200);

    const users = await fetch(`${baseUrl}/usuario`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const body = await users.json();
    assert.equal(users.status, 200);
    assert.ok(body.Usuario.every((user) => !Object.hasOwn(user, "senha_hash")));
});

test("roles limit access to user management, logs, and operational resources", async () => {
    const sales = await models.Usuario.create({
        nome: "Usuário de vendas",
        email: `test-sales-${randomUUID()}@example.invalid`,
        senha_hash: await bcrypt.hash(randomBytes(24).toString("base64url"), 10),
        papel: "vendas",
        ativo: 1
    });
    const stock = await models.Usuario.create({
        nome: "Usuário de estoque",
        email: `test-stock-${randomUUID()}@example.invalid`,
        senha_hash: await bcrypt.hash(randomBytes(24).toString("base64url"), 10),
        papel: "estoque",
        ativo: 1
    });
    const viewer = await models.Usuario.create({
        nome: "Usuário de consulta",
        email: `test-viewer-${randomUUID()}@example.invalid`,
        senha_hash: await bcrypt.hash(randomBytes(24).toString("base64url"), 10),
        papel: "consulta",
        ativo: 1
    });
    extraUsers.push(sales, stock, viewer);

    const salesToken = require("../router/auth").createAccessToken(sales);
    const stockToken = require("../router/auth").createAccessToken(stock);
    const viewerToken = require("../router/auth").createAccessToken(viewer);

    const salesCustomers = await fetch(`${baseUrl}/cliente`, {
        headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert.equal(salesCustomers.status, 200);
    const salesStockExit = await fetch(`${baseUrl}/saida`, {
        headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert.equal(salesStockExit.status, 403);
    const salesUserList = await fetch(`${baseUrl}/usuario`, {
        headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert.equal(salesUserList.status, 403);
    const salesRoleChange = await fetch(`${baseUrl}/usuario/${sales.id_usu}/papel`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${salesToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ papel: "admin" })
    });
    assert.equal(salesRoleChange.status, 403);

    const stockList = await fetch(`${baseUrl}/estoque`, {
        headers: { Authorization: `Bearer ${stockToken}` }
    });
    assert.equal(stockList.status, 200);
    const stockUsers = await fetch(`${baseUrl}/usuario`, {
        headers: { Authorization: `Bearer ${stockToken}` }
    });
    assert.equal(stockUsers.status, 403);

    const viewerProducts = await fetch(`${baseUrl}/produto`, {
        headers: { Authorization: `Bearer ${viewerToken}` }
    });
    assert.equal(viewerProducts.status, 200);
    const viewerCustomers = await fetch(`${baseUrl}/cliente`, {
        headers: { Authorization: `Bearer ${viewerToken}` }
    });
    assert.equal(viewerCustomers.status, 403);
});

test("disabled users cannot continue using an existing token", async () => {
    await testUser.update({ ativo: 0 });
    try {
        const login = await postJson("/login", {
            email: testUser.email,
            senha: testPassword
        });
        assert.equal(login.status, 401);

        const response = await fetch(`${baseUrl}/cliente`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        assert.equal(response.status, 401);
    } finally {
        await testUser.update({ ativo: 1 });
    }
});

test("invalid bearer tokens are rejected", async () => {
    const response = await fetch(`${baseUrl}/cliente`, {
        headers: { Authorization: "Bearer not-a-valid-token" }
    });
    assert.equal(response.status, 401);
});
