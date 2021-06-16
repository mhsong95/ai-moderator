// botServer.js
// Defines a HTTPS server that serves request for moderator bots.

const express = require("express");
const https = require("httpolyglot");
const fs = require("fs");
const config = require("../media-server/config");
const path = require("path");
const io = require("socket.io-client");
const mediasoupClient = require("mediasoup-client");

// SSL parameters
const options = {
  key: fs.readFileSync(path.join(__dirname, config.sslKey)),
  cert: fs.readFileSync(path.join(__dirname, config.sslCrt)),
};

const botApp = express();
const botServer = https.createServer(options, botApp);

// Use body parser
botApp.use(express.urlencoded({ extended: true }));
botApp.use(express.json());

// Initialize bot list.
const { botList } = require("./lib/global");
const Moderator = require("./lib/Moderator");

// Request for a bot
botApp.post("/", function (req, res, next) {
  // TODO: check requester IP (only the media server is allowed).
  // Or share a secret in like config.js
  const { room_id, room_secret } = req.body;
  console.log(`Request for moderator from ${room_id}`);

  // TODO: httpAgent option. use io.Manager. put hostname in config.js
  let socket = io("ws://localhost:3016/");

  socket.request = function request(type, data = {}) {
    return new Promise((resolve, reject) => {
      socket.emit(type, data, (data) => {
        if (data.error) {
          reject(data.error);
        } else {
          resolve(data);
        }
      });
    });
  };

  let moderator = new Moderator(
    socket,
    room_id,
    room_secret,
    () => {
      moderator.on(Moderator.EVENTS.exitRoom, () => {
        console.log(`Moderator exited room ${room_id}`);
        botList.delete(room_id);
      });

      console.log(`Moderator joined room ${room_id}`);
      botList.set(room_id, moderator);

      res.status(200).send();
    },
    (err) => {
      console.log(`Moderator failed to join room ${room_id}: ${err}`);
      res.status(500).send();
    }
  );
});

// TODO: create a separate config.js file for botServer
botServer.listen(3017, () => {
  console.log("Bot server started listening https " + 3017);
});
