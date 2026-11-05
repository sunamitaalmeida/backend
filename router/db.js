const { sequelize, models } = require("../mysql");

function transaction(callback) {
    return sequelize.transaction(async (sequelizeTransaction) => {
        return callback({ transaction: sequelizeTransaction });
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

module.exports = { transaction, httpError, numericId, requiredText, positiveInteger, models };
