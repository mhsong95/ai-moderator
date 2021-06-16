// global.js 
// Defines and exports objects that are shared("global") 
// across multiple files in bot server.

/**
 * botList
 * {
 *   room_id: Moderator
 * }
 */
const botList = new Map();

module.exports = {
  botList,
};
