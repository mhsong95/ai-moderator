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

    socket.removeAllListeners("disconnect");
    socket.removeAllListeners("exitRoom");

    socket.on("disconnect", () => {
      console.log(
        `---disconnect--- name: ${
          roomList.get(socket.room_id) &&
          roomList.get(socket.room_id).getPeers().get(socket.id).name
        }`
      );
      if (!socket.room_id) return;
      if (!roomList.has(socket.room_id)) return;

      let room = roomList.get(socket.room_id);
      room.removePeer(socket.id);
      room.moderator = null;

      if (room.getPeers().size === 0) {
        if (room.roomExpireTimeout) {
          clearTimeout(room.roomExpireTimeout);
        }
        room.roomExpireTimeout = setTimeout(() => {
          room.roomExpireTimeout = null;
          if (room.router) {
            room.router.close();
            room.router = null;
          }
          roomList.delete(room.id);

          console.log(`DESTROYED: ${room.id} after timeout`);
        }, 30 * 1000);
      }

      socket.room_id = null;
    });

    socket.on("exitRoom", async (_, callback) => {
      console.log(
        `---exit room--- name: ${
          roomList.get(socket.room_id) &&
          roomList.get(socket.room_id).getPeers().get(socket.id).name
        }`
      );
      if (!roomList.has(socket.room_id)) {
        callback({
          error: "not currently in a room",
        });
        return;
      }
      // close transports
      let room = roomList.get(socket.room_id);
      await room.removePeer(socket.id);
      room.moderator = null;

      if (room.getPeers().size === 0) {
        if (room.roomExpireTimeout) {
          clearTimeout(room.roomExpireTimeout);
        }
        room.roomExpireTimeout = null;
        if (room.router) {
          room.router.close();
          room.router = null;
        }
        roomList.delete(room.id);

        console.log(`DESTROYED: ${room.id} because empty`);
      }

      socket.room_id = null;

      callback("successfully exited room");
    });

    cb(room.toJson());
  });
};
