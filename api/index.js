require('dotenv').config();

const app = require('../app');
const connectDB = require('../config/db');

let databaseConnection;

module.exports = async function handler(req, res) {
  if (!databaseConnection) {
    databaseConnection = connectDB().catch((error) => {
      databaseConnection = undefined;
      throw error;
    });
  }

  await databaseConnection;
  return app(req, res);
};
