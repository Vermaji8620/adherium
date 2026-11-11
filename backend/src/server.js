const { config } = require('./config');
const { connect } = require('./db');
const { createApp } = require('./create-app');
(async () => {
  const c = config();
  try {
    await connect(c.mongoUri);
    const server = createApp().listen(c.port, '127.0.0.1', () =>
      console.log(`Adherium API listening on http://127.0.0.1:${c.port}`),
    );
    for (const signal of ['SIGINT', 'SIGTERM'])
      process.on(signal, () => server.close(() => process.exit(0)));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
})();
