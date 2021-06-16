const https = require("https");
const fs = require("fs");
const config = require("../media-server/config");
const path = require("path");

// SSL parameters
const options = {
  key: fs.readFileSync(path.join(__dirname, config.sslKey), "utf-8"),
  cert: fs.readFileSync(path.join(__dirname, config.sslCrt), "utf-8"),
};

const httpsServer = https.createServer(options);
const io = require("socket.io")(httpsServer, {
  cors: {
    // TODO: Put the media server host name into config.js
    origin: "https://localhost:3016",
  },
});

const Clerk = require("./Clerk");
const { clerks } = require("./global");
const registerSpeechHandler = require("./speechHandler");

io.on("connection", (socket) => {
  const { room_id, name } = socket.handshake.query;
  if (room_id) {
    socket.join(room_id);
    if (!clerks.has(room_id)) {
      clerks.set(room_id, new Clerk(io, room_id));
      console.log(`Room created: ${room_id}`);
    }

    socket.room_id = room_id;
    socket.name = name;
    console.log(`${name} joined ${room_id} on moderator server`);

    registerSpeechHandler(io, socket);
  } else {
    socket.disconnect(true);
  }
});

io.of("/").adapter.on("delete-room", (room_id) => {
  if (clerks.has(room_id)) {
    let clerk = clerks.get(room_id);
    clerk.clearSwitchTimeout();
    clerks.delete(room_id);
    console.log(`Room deleted: ${room_id}`);
  }
});

// TODO: add port number into config.js
httpsServer.listen(3017, () => {
  console.log(`Moderator server listening on port 3017`);
});
