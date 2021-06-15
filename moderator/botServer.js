// botServer.js
// Defines a HTTPS server that serves request for moderator bots.

const express = require("express");
const https = require("httpolyglot");
const fs = require("fs");
const config = require("../media-server/config");
const path = require("path");

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

// Request for a bot
botApp.post("/", function (req, res, next) {
  // TODO: check requester IP (only the media server is allowed).
  // Or share a secret in like config.js
  const { room_id, room_secret } = req.body;
  res.status(200).send();
  console.log(room_id, room_secret);
});

// TODO: create a separate config.js file for botServer
// TODO: add a new command to package.json
botServer.listen(3017, () => {
  console.log("Bot server started listening https " + 3017);
});
