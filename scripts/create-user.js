require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sequelize, models } = require("../mysql");

function readHidden(prompt) {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
        return Promise.reject(new Error("Execute este comando em um terminal interativo."));
    }

    return new Promise((resolve, reject) => {
        let value = "";
        const input = process.stdin;
        const cleanup = () => {
            input.removeListener("data", onData);
            input.setRawMode(false);
            input.pause();
            process.stdout.write("\n");
        };
        const onData = (chunk) => {
            const text = chunk.toString("utf8");
            if (text === "\u0003") {
                cleanup();
                reject(new Error("Operação cancelada."));
            } else if (text === "\r" || text === "\n") {
                cleanup();
                resolve(value);
            } else if (text === "\u007f" || text === "\b") {
                value = value.slice(0, -1);
            } else if (text >= " ") {
                value += text;
            }
        };

        process.stdout.write(prompt);
        input.setRawMode(true);
        input.resume();
        input.on("data", onData);
    });
}

async function main() {
    const [nome, emailInput, role = "consulta"] = process.argv.slice(2);
    if (!nome || !emailInput) {
        throw new Error('Uso: npm run create-user -- "Nome" email@exemplo.com [admin|vendas|estoque|consulta]');
    }
    if (!["admin", "vendas", "estoque", "consulta"].includes(role)) {
        throw new Error("Papel inválido. Use admin, vendas, estoque ou consulta.");
    }

    const email = emailInput.trim().toLowerCase();
    const password = await readHidden("Senha (12 a 72 bytes): ");
    const confirmation = await readHidden("Confirme a senha: ");
    if (password !== confirmation) {
        throw new Error("As senhas não correspondem.");
    }
    if (Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) {
        throw new Error("A senha deve ter entre 12 e 72 bytes.");
    }

    await sequelize.authenticate();
    const existing = await models.Usuario.findOne({ where: { email }, attributes: ["id_usu"] });
    if (existing) {
        throw new Error("Já existe um usuário com esse e-mail.");
    }

    const user = await models.Usuario.create({
        nome: nome.trim(),
        email,
        senha_hash: await bcrypt.hash(password, 10),
        papel: role,
        ativo: 1
    });
    console.log(`Usuário criado com sucesso (id ${user.id_usu}).`);
}

main()
    .catch((error) => {
        console.error(`Não foi possível criar o usuário: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(() => sequelize.close());
