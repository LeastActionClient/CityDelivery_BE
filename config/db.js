const mongoose = require('mongoose');
const { env } = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  // Request payloads, query strings and route params are checked by
  // rejectMongoOperators before they reach any database query. Keeping
  // sanitizeFilter disabled avoids rewriting trusted internal operators such
  // as $gte/$or into invalid Date values.
  mongoose.set('sanitizeFilter', false);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`[db] MongoDB connected (${mongoose.connection.name})`);
}

module.exports = connectDB;
