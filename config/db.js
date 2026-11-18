const mongoose = require('mongoose');
const { env } = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  mongoose.set('sanitizeFilter', true); // blocks $-operator injection inside filters
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`[db] MongoDB connected (${mongoose.connection.name})`);
}

module.exports = connectDB;
