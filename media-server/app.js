const express = require("express");
const https = require("httpolyglot");
const logger = require("morgan");
const session = require("express-session");
const fs = require("fs");
const config = require("./config");
const path = require("path");

// SSL parameters
const options = {
  key: fs.readFileSync(path.join(__dirname, config.sslKey), "utf-8"),
  cert: fs.readFileSync(path.join(__dirname, config.sslCrt), "utf-8"),
};

const app = express();
const httpsServer = https.createServer(options, app);
const io = require("socket.io")(httpsServer);

// View engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("html", require("ejs").renderFile);

// Middlewares
app.use(express.static(path.join(__dirname, "public")));
app.use(logger("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: "fh8ewa9f&$#)@sample#secret(&for$#()development&(HFIAO1749",
    resave: false,
    saveUninitialized: false,
  })
);

// Routes
app.use("/", require("./routes/index"));
app.use("/room", require("./routes/room")(io));

// Initialize room dictionary and workers.
const { roomList } = require("./lib/global");
const { createWorkers } = require("./lib/Worker");
(async () => {
  await createWorkers();
})();

// User event handlers
const registerUserHandler = require("./handlers/userHandler");
io.on("connection", (socket) => {
  registerUserHandler(io, socket);
});

httpsServer.listen(config.listenPort, () => {
  console.log(`media server listening on https ${config.listenPort}`);
});
