const pool = require("../mysql").pool;

function query(connection, sql, values = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
    });
}

function withConnection(callback) {
    return new Promise((resolve, reject) => {
        pool.getConnection(async (error, connection) => {
            if (error) return reject(error);
            try {
                resolve(await callback(connection));
            } catch (callbackError) {
                reject(callbackError);
            } finally {
                connection.release();
            }
        });
    });
}

function transaction(callback) {
    return withConnection(async (connection) => {
        await new Promise((resolve, reject) => {
            connection.beginTransaction((error) => error ? reject(error) : resolve());
        });
        try {
            const result = await callback(connection);
            await new Promise((resolve, reject) => {
                connection.commit((error) => error ? reject(error) : resolve());
            });
            return result;
        } catch (error) {
            await new Promise((resolve, reject) => {
                connection.rollback((rollbackError) => rollbackError ? reject(rollbackError) : resolve());
            });
            throw error;
        }
    });
}

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function numericId(value, field = "id") {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
        throw httpError(400, `${field} deve ser um número inteiro positivo.`);
    }
    return id;
}

function requiredText(value, field, maxLength) {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
        throw httpError(400, `${field} é obrigatório e deve ter até ${maxLength} caracteres.`);
    }
    return value.trim();
}

function positiveInteger(value, field) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
        throw httpError(400, `${field} deve ser um número inteiro positivo.`);
    }
    return number;
}

module.exports = { query, withConnection, transaction, httpError, numericId, requiredText, positiveInteger };
