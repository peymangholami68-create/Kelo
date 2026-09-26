// Compatibility entry point.
// The canonical Kelo server is server/app.js; keeping a single auth/session
// implementation prevents the old standalone server from drifting.
require('./app');
