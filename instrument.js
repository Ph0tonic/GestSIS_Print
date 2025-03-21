const Sentry = require("@sentry/node");
require("dotenv").config();

console.log(`GestSIS Print listening on port ${process.env.SENTRY_DSN}`);

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});
