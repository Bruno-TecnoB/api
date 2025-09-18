const { DataTypes } = require("sequelize");
const sequelize = require("../db/conn");

const IntegracaoMagalu = sequelize.define(
  "IntegracaoMagalu",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    db_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    cnpj: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    client_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    client_secret: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    expiresIn: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM("Pendente", "Ativo", "Inativo"),
      defaultValue: "Pendente",
    },
  },
  {
    tableName: "integracoes_magalu",
    timestamps: true,
  }
);

module.exports = IntegracaoMagalu;
