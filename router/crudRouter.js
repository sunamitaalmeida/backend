const { query, withConnection, httpError, numericId } = require("./db");

function activeFlag(value) {
    const active = Number(value);
    if (![0, 1].includes(active)) throw httpError(400, "ativo deve ser 0 ou 1.");
    return active;
}

function normalizeField(field) {
    if (typeof field === "string") {
        return { key: field, insert: true, update: true };
    }
    return field;
}

function resolveInsertValue(reqBody, field) {
    const value = reqBody[field.key];
    if (value === undefined) {
        if (field.default !== undefined) {
            return field.default;
        }
        if (field.required) {
            throw httpError(400, `${field.key} é obrigatório.`);
        }
        return undefined;
    }
    if (field.transform) return field.transform(value, reqBody);
    if (field.validate) return field.validate(value, reqBody);
    return value;
}

function resolveUpdateValue(reqBody, field) {
    if (reqBody[field.key] === undefined) return undefined;
    if (field.transform) return field.transform(reqBody[field.key], reqBody);
    if (field.validate) return field.validate(reqBody[field.key], reqBody);
    return reqBody[field.key];
}

function createCrudRouter({
    tableName,
    idColumn = "id",
    resourceName = "Registro",
    listSelect = "*",
    customListQuery,
    customGetQuery,
    fields = []
}) {
    const express = require("express");
    const router = express.Router();

    const insertFields = fields.filter((field) => normalizeField(field).insert !== false).map(normalizeField);
    const updateFields = fields.filter((field) => normalizeField(field).update !== false).map(normalizeField);

    router.get("/", async (req, res) => {
        const sql = customListQuery || `SELECT ${listSelect} FROM ${tableName} ORDER BY ${idColumn} DESC`;
        const rows = await withConnection((conn) => query(conn, sql));
        res.status(200).json({ [resourceName]: rows });
    });

    router.get("/:id", async (req, res) => {
        const id = numericId(req.params.id, idColumn);
        const sql = customGetQuery || `SELECT ${listSelect} FROM ${tableName} WHERE ${idColumn} = ?`;
        const [row] = await withConnection((conn) => query(conn, sql, [id]));
        if (!row) throw httpError(404, `${resourceName} não encontrado.`);
        res.status(200).json({ [resourceName]: row });
    });

    router.post("/", async (req, res) => {
        const columns = [];
        const values = [];

        for (const field of insertFields) {
            const value = resolveInsertValue(req.body, field);
            if (value === undefined) continue;
            columns.push(field.key);
            values.push(value);
        }

        if (!columns.length) {
            throw httpError(400, `Informe ao menos um campo para criar ${resourceName.toLowerCase()}.`);
        }

        const result = await withConnection((conn) =>
            query(conn, `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, values)
        );

        res.status(201).json({
            mensagem: `${resourceName} criado com sucesso.`,
            [idColumn]: result.insertId
        });
    });

    router.patch("/:id", async (req, res) => {
        const id = numericId(req.params.id, idColumn);
        const fieldsToUpdate = [];
        const values = [];

        for (const field of updateFields) {
            const value = resolveUpdateValue(req.body, field);
            if (value === undefined) continue;
            fieldsToUpdate.push(`${field.key} = ?`);
            values.push(value);
        }

        if (!fieldsToUpdate.length) {
            throw httpError(400, "Informe ao menos um campo para atualizar.");
        }

        values.push(id);
        const result = await withConnection((conn) =>
            query(conn, `UPDATE ${tableName} SET ${fieldsToUpdate.join(", ")} WHERE ${idColumn} = ?`, values)
        );

        if (!result.affectedRows) {
            const [row] = await withConnection((conn) =>
                query(conn, `SELECT ${idColumn} FROM ${tableName} WHERE ${idColumn} = ?`, [id])
            );
            if (!row) throw httpError(404, `${resourceName} não encontrado.`);
        }

        res.status(200).json({ mensagem: `${resourceName} atualizado com sucesso.` });
    });

    router.delete("/:id", async (req, res) => {
        const id = numericId(req.params.id, idColumn);
        const result = await withConnection((conn) =>
            query(conn, `DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [id])
        );
        if (!result.affectedRows) throw httpError(404, `${resourceName} não encontrado.`);
        res.status(200).json({ mensagem: `${resourceName} removido com sucesso.` });
    });

    return router;
}

module.exports = { createCrudRouter, activeFlag };
