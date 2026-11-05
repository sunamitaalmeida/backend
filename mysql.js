require("dotenv").config();

const { Sequelize, DataTypes } = require("sequelize");

const requiredDatabaseVariables = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingDatabaseVariables = requiredDatabaseVariables.filter((name) => !process.env[name]);
if (missingDatabaseVariables.length) {
    throw new Error(`Variáveis de banco ausentes: ${missingDatabaseVariables.join(", ")}.`);
}

const databasePort = process.env.DB_PORT === undefined ? 3306 : Number(process.env.DB_PORT);
if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) {
    throw new Error("DB_PORT deve ser uma porta entre 1 e 65535.");
}

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        dialect: "mysql",
        host: process.env.DB_HOST,
        port: databasePort,
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

function defineModel(tableName, idColumn, attributes) {
    return sequelize.define(tableName, {
        [idColumn]: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        ...attributes
    }, {
        tableName,
        timestamps: false
    });
}

const timestampFields = {
    criado_em: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
    },
    atualizado_em: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
    }
};

const models = {
    Categoria: defineModel("categorias", "id_categoria", {
        nome: { type: DataTypes.STRING(100), allowNull: false },
        descricao: { type: DataTypes.TEXT, allowNull: true },
        ativo: { type: DataTypes.TINYINT, defaultValue: 1 }
    }),
    Cliente: defineModel("clientes", "id_cliente", {
        nome: { type: DataTypes.STRING(100), allowNull: false },
        email: { type: DataTypes.STRING(100), allowNull: false },
        contato: { type: DataTypes.STRING(20), allowNull: true },
        ativo: { type: DataTypes.TINYINT, defaultValue: 1 },
        ...timestampFields
    }),
    Entrada: defineModel("entradas", "id_entrada", {
        id_produto: { type: DataTypes.INTEGER, allowNull: false },
        id_fornecedor: { type: DataTypes.INTEGER, allowNull: false },
        quantidade: { type: DataTypes.INTEGER, allowNull: false },
        valor_unitario: { type: DataTypes.DOUBLE(10, 2), allowNull: false },
        data_entrada: { type: DataTypes.DATEONLY, allowNull: true },
        observacao: { type: DataTypes.STRING(200), allowNull: true },
        ...timestampFields
    }),
    Estoque: defineModel("estoque", "id_estoque", {
        id_produto: { type: DataTypes.INTEGER, allowNull: false },
        quantidade: { type: DataTypes.INTEGER, allowNull: false },
        estoque_minimo: { type: DataTypes.INTEGER, allowNull: true },
        estoque_maximo: { type: DataTypes.INTEGER, allowNull: true },
        localizacao: { type: DataTypes.STRING(100), allowNull: true }
    }),
    Fornecedor: defineModel("fornecedores", "id_fornecedor", {
        nome: { type: DataTypes.STRING(100), allowNull: false },
        empresa: { type: DataTypes.STRING(100), allowNull: true },
        email: { type: DataTypes.STRING(100), allowNull: true },
        telefone: { type: DataTypes.STRING(20), allowNull: true },
        cidade: { type: DataTypes.STRING(50), allowNull: true },
        estado: { type: DataTypes.CHAR(2), allowNull: true },
        ativo: { type: DataTypes.TINYINT, defaultValue: 1 },
        ...timestampFields
    }),
    Funcionario: defineModel("funcionarios", "id_funcionario", {
        nome: { type: DataTypes.STRING(100), allowNull: false },
        cargo: { type: DataTypes.STRING(50), allowNull: false },
        salario: { type: DataTypes.DOUBLE(10, 2), allowNull: false },
        telefone: { type: DataTypes.STRING(20), allowNull: true },
        email: { type: DataTypes.STRING(100), allowNull: true },
        data_admissao: { type: DataTypes.DATEONLY, allowNull: true },
        ativo: { type: DataTypes.TINYINT, defaultValue: 1 },
        criado_em: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        atualizado_em: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
    }),
    HistoricoPreco: defineModel("historico_precos", "id_historico", {
        id_produto: { type: DataTypes.INTEGER, allowNull: true },
        preco: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        vigencia: { type: DataTypes.DATEONLY, allowNull: true }
    }),
    Log: defineModel("logs", "id_log", {
        usuario: { type: DataTypes.STRING(100), allowNull: true },
        tabela_afetada: { type: DataTypes.STRING(100), allowNull: true },
        acao: { type: DataTypes.STRING(50), allowNull: true },
        registro: { type: DataTypes.INTEGER, allowNull: true },
        data_hora: { type: DataTypes.DATE, allowNull: true }
    }),
    Movimentacao: defineModel("movimentacoes", "id_movimentacao", {
        id_produto: { type: DataTypes.INTEGER, allowNull: true },
        tipo: { type: DataTypes.ENUM("E", "S", "A", "P", "T"), allowNull: true },
        quantidade: { type: DataTypes.INTEGER, allowNull: true },
        data_movimentacao: { type: DataTypes.DATE, allowNull: true },
        observacao: { type: DataTypes.TEXT, allowNull: true }
    }),
    Pedido: defineModel("pedidos", "id_pedido", {
        status: { type: DataTypes.TINYINT, defaultValue: 1 },
        data_pedido: { type: DataTypes.DATEONLY, allowNull: true },
        id_cliente: { type: DataTypes.INTEGER, allowNull: true },
        ...timestampFields
    }),
    PedidoItem: defineModel("pedido_itens", "id_item", {
        id_pedido: { type: DataTypes.INTEGER, allowNull: true },
        id_produto: { type: DataTypes.INTEGER, allowNull: true },
        quantidade: { type: DataTypes.INTEGER, allowNull: true },
        valor_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: true }
    }),
    Produto: defineModel("produtos", "id_produto", {
        nome: { type: DataTypes.STRING(100), allowNull: true },
        descricao: { type: DataTypes.STRING(200), allowNull: false },
        preco: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        imagem_produto: { type: DataTypes.STRING(255), allowNull: false },
        ...timestampFields,
        id_categoria: { type: DataTypes.INTEGER, allowNull: true }
    }),
    Saida: defineModel("saidas", "id_saida", {
        id_produto: { type: DataTypes.INTEGER, allowNull: false },
        id_funcionario: { type: DataTypes.INTEGER, allowNull: false },
        quantidade: { type: DataTypes.INTEGER, allowNull: false },
        valor_unitario: { type: DataTypes.DOUBLE(10, 2), allowNull: false },
        data_saida: { type: DataTypes.DATEONLY, allowNull: true },
        destino: { type: DataTypes.STRING(100), allowNull: true },
        criado_em: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        atualizado_em: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        }
    }),
    Usuario: defineModel("usuarios", "id_usu", {
        nome: { type: DataTypes.STRING(80), allowNull: false },
        email: { type: DataTypes.STRING(100), allowNull: false },
        senha_hash: { type: DataTypes.STRING(255), allowNull: false },
        contato: { type: DataTypes.STRING(20), allowNull: true },
        genero: { type: DataTypes.CHAR(1), allowNull: true },
        papel: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "consulta" },
        ativo: { type: DataTypes.TINYINT, defaultValue: 1 },
        ...timestampFields
    })
};

models.Entrada.belongsTo(models.Produto, { as: "produto", foreignKey: "id_produto", constraints: false });
models.Entrada.belongsTo(models.Fornecedor, { as: "fornecedor", foreignKey: "id_fornecedor", constraints: false });
models.Estoque.belongsTo(models.Produto, { as: "produto", foreignKey: "id_produto", constraints: false });
models.HistoricoPreco.belongsTo(models.Produto, { as: "produto", foreignKey: "id_produto", constraints: false });
models.Movimentacao.belongsTo(models.Produto, { as: "produto", foreignKey: "id_produto", constraints: false });
models.Pedido.belongsTo(models.Cliente, { as: "cliente", foreignKey: "id_cliente", constraints: false });
models.Pedido.hasMany(models.PedidoItem, { as: "itens", foreignKey: "id_pedido", constraints: false });
models.PedidoItem.belongsTo(models.Produto, { as: "produto", foreignKey: "id_produto", constraints: false });
models.Saida.belongsTo(models.Produto, { as: "produto", foreignKey: "id_produto", constraints: false });
models.Saida.belongsTo(models.Funcionario, { as: "funcionario", foreignKey: "id_funcionario", constraints: false });

module.exports = { sequelize, models };
