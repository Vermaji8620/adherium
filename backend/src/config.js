const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function config(env = process.env) {
  return {
    port: Number(env.PORT || 4000),
    mongoUri: env.MONGODB_URI || '',
    nodeEnv: env.NODE_ENV || 'development',
  };
}
module.exports = { config };
