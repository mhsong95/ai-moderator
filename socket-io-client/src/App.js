import React from "react";
import socketIOClient from "socket.io-client";
// import config from "./config";
// const https = require("https");
// const fs = require("fs");
// const path = require("path");
// var http = require('http')
// const config = require("./config");
const Clerk = require("./Clerk");
const { clerks } = require("./global");
const registerSpeechHandler = require("./speechHandler");

// const ENDPOINT = "http://127.0.0.1:8001";
// const express = require('express');
// const ex_app = express();

// ex_app.use(express.static(path.join(__dirname, 'build')))

// ex_app.get('/ping', (req, res) => {
//   return res.send('pong')
// })

// ex_app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'build', 'index.html'))
// })

// ex_app.listen(8001)

const ENDPOINT = "http://127.0.0.1:8000";

// SSL parameters
// const options = {
//   key: fs.readFileSync(path.join(__dirname, config.sslKey), "utf-8"),
//   cert: fs.readFileSync(path.join(__dirname, config.sslCrt), "utf-8"),
// };

// const httpsServer = https.createServer(options);
// const httpServer = http.createServer(config.mediaServerHost);
// const io = require("socket.io")(config.mediaServerHost);

function App() {
  // const [response, setResponse] = useState("");

  // useEffect(() => {
    const io = socketIOClient(ENDPOINT);
    // const io = socketIOClient(8001, {
    //   cors: {
    //     origin: config.mediaServerHost,
    //   }
    // })
    // socket.on("FromAPI", data => {
    //   setResponse(data);
    // });
  

///////////////////
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

  // io.of("/").adapter.on("delete-room", (room_id) => {
  //   if (clerks.has(room_id)) {
  //     let clerk = clerks.get(room_id);
  //     clerk.clearSwitchTimeout();
  //     clerks.delete(room_id);
  //     console.log(`Room deleted: ${room_id}`);
  //   }
  // });
    // }, []);

  // httpServer.listen(config.listenPort, () => {
  //   console.log(`moderator server listening https ${config.listenPort}`);
  // });
///////////////////





  return (
    <p>
      {/* It's <time dateTime={response}>{response}</time> */}
    </p>
  );
}

export default App;