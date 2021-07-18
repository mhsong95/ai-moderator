// userHandler.js
// Defines event handlers for a socket connected to a user.
// This module should be required to register those event handlers.

const { roomList } = require("../lib/global");
const { getMediasoupWorker } = require("../lib/Worker");
const Room = require("../lib/Room");
const Peer = require("../lib/Peer");
var fs = require('fs');

module.exports = function (io, socket) {
  socket.on("createRoom", async ({ room_id }, callback) => {
    if (roomList.has(room_id)) {
      callback("already exists");
    } else {
      console.log("---created room--- ", room_id);
      let worker = await getMediasoupWorker();
      roomList.set(room_id, new Room(room_id, "random name", worker, io));
      callback(room_id);
    }
  });

  socket.on("saveLog", ({ room_name, user_name, userLog }) => {
    for (var timestamp in userLog) {
      // Construct new log file for user
      fs.appendFile('logs/' + room_name + '_' + user_name + '_' + socket.room_id + '.txt', userLog[timestamp], function (err) {
        if (err) throw err;
        console.log('Log is added successfully.');
      });
    }
  });

  socket.on("join", ({ room_id, room_name, name }, cb) => {
    console.log('---user joined--- "' + room_id + '": ' + name);
    if (!roomList.has(room_id)) {
      return cb({
        error: "room does not exist",
      });
    }

    // Construct new log file for user
    let msg = '(' + Date.now() + ') User ' + name + ' joined.\n';
    msg = msg + '                [roomID] ' + room_id + '\n';
    msg = msg + '                [roomName] ' + room_name + '\n';
    msg = msg + '                [userName] ' + name + '\n';
    msg = msg + '                [socketID] ' + socket.id + '\n';
    fs.appendFile('logs/' + room_name + '_' + name + '_' + room_id + '.txt', msg, function (err) {
      if (err) throw err;
      console.log('File is created successfully.');
    });

    let room = roomList.get(room_id);
    if (room.roomExpireTimeout) {
      clearTimeout(room.roomExpireTimeout);
      room.roomExpireTimeout = null;
    }

    room.addPeer(new Peer(socket.id, name));
    socket.room_id = room_id;

    cb(roomList.get(room_id).toJson());
  });

  socket.on("getProducers", () => {
    console.log(
      `---get producers--- name:${roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    // send all the current producer to newly joined member
    if (!roomList.has(socket.room_id)) return;
    let producerList = roomList
      .get(socket.room_id)
      .getProducerListForPeer(socket.id);

    socket.emit("newProducers", producerList);
  });

  socket.on("getRouterRtpCapabilities", (_, callback) => {
    console.log(
      `---get RouterRtpCapabilities--- name: ${roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    try {
      callback(roomList.get(socket.room_id).getRtpCapabilities());
    } catch (e) {
      callback({
        error: e.message,
      });
    }
  });

  socket.on("createWebRtcTransport", async (_, callback) => {
    console.log(
      `---create webrtc transport--- name: ${roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    try {
      const { params } = await roomList
        .get(socket.room_id)
        .createWebRtcTransport(socket.id);

      callback(params);
    } catch (err) {
      console.error(err);
      callback({
        error: err.message,
      });
    }
  });

  socket.on(
    "connectTransport",
    async ({ transport_id, dtlsParameters }, callback) => {
      console.log(
        `---connect transport--- name: ${roomList.get(socket.room_id).getPeers().get(socket.id).name
        }`
      );
      if (!roomList.has(socket.room_id)) return;
      await roomList
        .get(socket.room_id)
        .connectPeerTransport(socket.id, transport_id, dtlsParameters);

      callback("success");
    }
  );

  socket.on(
    "produce",
    async ({ kind, rtpParameters, producerTransportId }, callback) => {
      if (!roomList.has(socket.room_id)) {
        return callback({ error: "not is a room" });
      }

      let producer_id = await roomList
        .get(socket.room_id)
        .produce(socket.id, producerTransportId, rtpParameters, kind);
      console.log(
        `---produce--- type: ${kind} name: ${roomList.get(socket.room_id).getPeers().get(socket.id).name
        } id: ${producer_id}`
      );
      callback({
        producer_id,
      });
    }
  );

  socket.on(
    "consume",
    async ({ consumerTransportId, producerId, rtpCapabilities }, callback) => {
      //TODO null handling
      let params = await roomList
        .get(socket.room_id)
        .consume(socket.id, consumerTransportId, producerId, rtpCapabilities);

      console.log(
        `---consuming--- name: ${roomList.get(socket.room_id) &&
        roomList.get(socket.room_id).getPeers().get(socket.id).name
        } prod_id:${producerId} consumer_id:${params.id}`
      );
      callback(params);
    }
  );

  socket.on("getMyRoomInfo", (_, cb) => {
    cb(roomList.get(socket.room_id).toJson());
  });

  socket.on("disconnect", () => {
    let room = roomList.get(socket.room_id);
    console.log(
      `---disconnect--- name: ${room &&
      room.getPeers().get(socket.id).name
      }`
    );
    if (!socket.room_id) return;
    if (!roomList.has(socket.room_id)) return;

    let logfile = 'logs/' + room.name + '_' + room.getPeers().get(socket.id).name + '_' + socket.room_id + '.txt';
    fs.appendFile(logfile, '(' + Date.now() + ') Exit\n', function (err) {
      if (err) throw err;
      console.log('Log is added successfully.');
    });
    room.removePeer(socket.id);

    if (room.getPeers().size === 0) {
      if (room.roomExpireTimeout) {
        clearTimeout(room.roomExpireTimeout);
      }
      room.roomExpireTimeout = setTimeout(() => {
        if (room.router) {
          room.router.close();
          room.router = null;
        }
        room.roomExpireTimeout = null;

        roomList.delete(room.id);
        console.log(`DESTROYED: ${room.id} after timeout`);
      }, 30 * 1000);
    }

    socket.room_id = null;
  });

  socket.on("producerClosed", ({ producer_id }) => {
    console.log(
      `---producer close--- name: ${roomList.get(socket.room_id) &&
      roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`
    );
    if (!roomList.has(socket.room_id)) return;
    roomList.get(socket.room_id).closeProducer(socket.id, producer_id);
  });

  socket.on("exitRoom", async (_, callback) => {
    console.log(
      `---exit room--- name: ${roomList.get(socket.room_id) &&
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

    if (roomList.get(socket.room_id).getPeers().size === 0) {
      if (room.roomExpireTimeout) {
        clearTimeout(room.roomExpireTimeout);
        room.roomExpireTimeout = null;
      }
      if (room.router) {
        room.router.close();
        room.router = null;
      }

      roomList.delete(socket.room_id);
      console.log(`DESTROYED: ${socket.room_id} after timeout`);
    }

    socket.room_id = null;

    callback("successfully exited room");
  });
};

function room() {
  return Object.values(roomList).map((r) => {
    return {
      router: r.router.id,
      peers: Object.values(r.peers).map((p) => {
        return {
          name: p.name,
        };
      }),
      id: r.id,
    };
  });
}
