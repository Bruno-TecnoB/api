const { DataTypes } = require("sequelize");
const sequelize = require("../db/conn");

const integracaoML = sequelize.define(
  "integracao_ML",
  {
    name: { type: DataTypes.STRING, allowNull: false },
    db_name: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false },
    cnpj: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: true },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    client_secret: { type: DataTypes.STRING, allowNull: false },
    refreshToken: { type: DataTypes.STRING, allowNull: true },
    AccessToken: { type: DataTypes.STRING, allowNull: true },
  },

  { tableName: "integracao_ml", timestamps: true }
);

module.exports = integracaoML;
