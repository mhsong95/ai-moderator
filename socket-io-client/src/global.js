// global.js
// Defines data structures that are shared across files (global).

// Maps room_id to Clerk instances.
const clerks = new Map();

module.exports = {
  clerks,
};