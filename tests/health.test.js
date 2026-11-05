const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { sequelize } = require("../mysql");

const originalAuthenticate = sequelize.authenticate;
let server;
let baseUrl;

before(async () => {
    sequelize.authenticate = async () => {};
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    sequelize.authenticate = originalAuthenticate;
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

test("health check reports when the database is available", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
});

test("health check reports database failures as unavailable", async () => {
    const originalError = console.error;
    console.error = () => {};
    sequelize.authenticate = async () => {
        throw new Error("database unavailable");
    };

    try {
        const response = await fetch(`${baseUrl}/health`);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: "unavailable" });
    } finally {
        console.error = originalError;
        sequelize.authenticate = async () => {};
    }
});
