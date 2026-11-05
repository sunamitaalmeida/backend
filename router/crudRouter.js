const { httpError, numericId, models } = require("./db");

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
    model,
    fields = []
}) {
    const express = require("express");
    const router = express.Router();

    const insertFields = fields.filter((field) => normalizeField(field).insert !== false).map(normalizeField);
    const updateFields = fields.filter((field) => normalizeField(field).update !== false).map(normalizeField);
    const resourceModel = model || models[tableName];
    if (!resourceModel) throw new Error(`Modelo Sequelize não configurado para a tabela ${tableName}.`);

    router.get("/", async (req, res) => {
        const rows = await resourceModel.findAll({
            attributes: listSelect === "*" ? undefined : listSelect.split(",").map((field) => field.trim()),
            order: [[idColumn, "DESC"]]
        });
        res.status(200).json({ [resourceName]: rows });
    });

    router.get("/:id", async (req, res) => {
        const id = numericId(req.params.id, idColumn);
        const row = await resourceModel.findByPk(id, {
            attributes: listSelect === "*" ? undefined : listSelect.split(",").map((field) => field.trim())
        });
        if (!row) throw httpError(404, `${resourceName} não encontrado.`);
        res.status(200).json({ [resourceName]: row });
    });

    router.post("/", async (req, res) => {
        const values = {};

        for (const field of insertFields) {
            const value = resolveInsertValue(req.body, field);
            if (value === undefined) continue;
            values[field.key] = value;
        }

        if (!Object.keys(values).length) {
            throw httpError(400, `Informe ao menos um campo para criar ${resourceName.toLowerCase()}.`);
        }

        const result = await resourceModel.create(values);

        res.status(201).json({
            mensagem: `${resourceName} criado com sucesso.`,
            [idColumn]: result.get(idColumn)
        });
    });

    router.patch("/:id", async (req, res) => {
        const id = numericId(req.params.id, idColumn);
        const values = {};

        for (const field of updateFields) {
            const value = resolveUpdateValue(req.body, field);
            if (value === undefined) continue;
            values[field.key] = value;
        }

        if (!Object.keys(values).length) {
            throw httpError(400, "Informe ao menos um campo para atualizar.");
        }

        const [updated] = await resourceModel.update(values, { where: { [idColumn]: id } });
        if (!updated && !(await resourceModel.findByPk(id))) throw httpError(404, `${resourceName} não encontrado.`);

        res.status(200).json({ mensagem: `${resourceName} atualizado com sucesso.` });
    });

    router.delete("/:id", async (req, res) => {
        const id = numericId(req.params.id, idColumn);
        const deleted = await resourceModel.destroy({ where: { [idColumn]: id } });
        if (!deleted) throw httpError(404, `${resourceName} não encontrado.`);
        res.status(200).json({ mensagem: `${resourceName} removido com sucesso.` });
    });

    return router;
}

module.exports = { createCrudRouter, activeFlag };
