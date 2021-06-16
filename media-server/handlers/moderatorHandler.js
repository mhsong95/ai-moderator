// moderatorHandler.js
// Defines event handlers for a socket connected to a moderator.
// This module should be required to register those event handlers.

const { roomList } = require("../lib/global");
const { getMediasoupWorker } = require("../lib/Worker");
const Room = require("../lib/Room");
const Peer = require("../lib/Peer");

module.exports = function (io, socket) {
  socket.on("moderatorJoin", ({ room_id, name, room_secret }, cb) => {
    if (!roomList.has(room_id)) {
      return cb({
        error: "room does not exist",
      });
    }

    let room = roomList.get(room_id);
    if (room_secret !== room.secret) {
      return cb({
        error: "not authorized",
      });
    }
    if (room.moderator !== null) {
      return cb({
        error: "moderator already exists",
      });
    }

    let moderatorPeer = new Peer(socket.id, name);
    room.addPeer(moderatorPeer);
    room.moderator = moderatorPeer;
    socket.room_id = room_id;

    console.log(`---Moderator joined--- ${room_id} ${name}`);

    // Add moderator
    // event listeners
    // here


    cb(room.toJson());
  });
}
