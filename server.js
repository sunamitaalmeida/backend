require('dotenv').config();
const http = require('http');

function validateConfiguration() {
    const errors = [];
    for (const name of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
        if (!process.env[name]) {
            errors.push(`${name} deve estar configurada.`);
        }
    }
    if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
        errors.push('JWT_SECRET deve estar configurada com pelo menos 32 bytes.');
    }

    for (const name of ['PORT', 'DB_PORT']) {
        const value = process.env[name];
        if (value !== undefined && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)) {
            errors.push(`${name} deve ser uma porta entre 1 e 65535.`);
        }
    }

    return errors;
}

async function start() {
    const configurationErrors = validateConfiguration();
    if (configurationErrors.length) {
        for (const error of configurationErrors) {
            console.error(error);
        }
        process.exitCode = 1;
        return;
    }

    const app = require('./app');
    const { sequelize } = require('./mysql');
    const server = http.createServer(app);
    const port = Number(process.env.PORT || 5000);

    try {
        await sequelize.authenticate();
        console.log('Conexão com o banco de dados estabelecida.');

        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, '0.0.0.0', () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
    } catch (error) {
        try {
            await sequelize.close();
        } catch (closeError) {
            console.error('Erro ao encerrar a conexão com o banco de dados:', closeError);
        }
        throw error;
    }
    console.log(`Servidor rodando na porta ${port}`);

    let shuttingDown = false;
    const shutdown = (signal) => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        console.log(`Sinal ${signal} recebido; encerrando servidor.`);
        server.close(async (serverError) => {
            if (serverError) {
                console.error('Erro ao encerrar o servidor HTTP:', serverError);
                process.exitCode = 1;
            }
            try {
                await sequelize.close();
            } catch (error) {
                console.error('Erro ao encerrar a conexão com o banco de dados:', error);
                process.exitCode = 1;
            }
        });
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
    console.error('Não foi possível iniciar o servidor:', error);
    process.exitCode = 1;
});
