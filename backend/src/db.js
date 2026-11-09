const mongoose = require('mongoose');
async function connect(uri) {
  if (!uri)
    throw new Error('MONGODB_URI is required. Set it in backend/.env.local.');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch {
    throw new Error(
      'MongoDB connection failed. Check the local URI and that MongoDB is reachable.',
    );
  }
}
module.exports = { connect };
