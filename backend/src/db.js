const mongoose = require('mongoose');
let connectionPromise;

async function connect(uri) {
  if (!uri)
    throw new Error('MONGODB_URI is required in the backend environment.');
  if (mongoose.connection.readyState === 1) return;
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose
    .connect(uri, { serverSelectionTimeoutMS: 5000 })
    .catch(() => {
      throw new Error(
        'MongoDB connection failed. Check MONGODB_URI and confirm the database accepts connections from this deployment.',
      );
    })
    .finally(() => {
      connectionPromise = undefined;
    });

  return connectionPromise;
}
module.exports = { connect };
