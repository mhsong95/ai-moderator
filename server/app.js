const express = require('express')
const https = require('httpolyglot')
const logger = require("morgan");
const session = require("express-session");
const fs = require('fs')
const mediasoup = require('mediasoup')
const config = require('./config')
const path = require('path')
const Room = require('./lib/Room')
const Peer = require('./lib/Peer')

// SSL parameters
const options = {
    key: fs.readFileSync(path.join(__dirname,config.sslKey), 'utf-8'),
    cert: fs.readFileSync(path.join(__dirname,config.sslCrt), 'utf-8')
}

const app = express()
const httpsServer = https.createServer(options, app)
const io = require('socket.io')(httpsServer)

// View engine
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "ejs")
app.engine("html", require("ejs").renderFile)

// Middlewares
app.use(express.static(path.join(__dirname, 'public')))
app.use(logger("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: "fh8ewa9f&$#)@sample#secret(&for$#()development&(HFIAO1749",
    resave: false,
    saveUninitialized: false,
}));

app.use("/", require("./routes/index"));
app.use("/room", require("./routes/room")(io));

/*
app.get("/", function (req, res, next) {
    res.render("index.html")
})
*/

httpsServer.listen(config.listenPort, () => {
    console.log('listening https ' + config.listenPort)
})

// Dictionary of all rooms. Maps room_id to Room objects.
const { roomList } = require("./lib/global");

// Methods for creating and selecting mediasoup workers.
const { createWorkers, getMediasoupWorker } = require("./lib/Worker");

(async () => {
    await createWorkers()
})()

io.on('connection', socket => {

    socket.on('createRoom', async ({
        room_id
    }, callback) => {
        if (roomList.has(room_id)) {
            callback('already exists')
        } else {
            console.log('---created room--- ', room_id)
            let worker = await getMediasoupWorker()
            roomList.set(room_id, new Room(room_id, "random name", worker, io))
            callback(room_id)
        }
    })

    socket.on('join', ({
        room_id,
        name
    }, cb) => {

        console.log('---user joined--- \"' + room_id + '\": ' + name)
        if (!roomList.has(room_id)) {
            return cb({
                error: 'room does not exist'
            })
        }
        roomList.get(room_id).addPeer(new Peer(socket.id, name))
        socket.room_id = room_id

        cb(roomList.get(room_id).toJson())
    })

    socket.on('getProducers', () => {
        console.log(`---get producers--- name:${roomList.get(socket.room_id).getPeers().get(socket.id).name}`)
        // send all the current producer to newly joined member
        if (!roomList.has(socket.room_id)) return
        let producerList = roomList.get(socket.room_id).getProducerListForPeer(socket.id)

        socket.emit('newProducers', producerList)
    })

    socket.on('getRouterRtpCapabilities', (_, callback) => {
        console.log(`---get RouterRtpCapabilities--- name: ${roomList.get(socket.room_id).getPeers().get(socket.id).name}`)
        try {
            callback(roomList.get(socket.room_id).getRtpCapabilities());
        } catch (e) {
            callback({
                error: e.message
            })
        }

    });

    socket.on('createWebRtcTransport', async (_, callback) => {
        console.log(`---create webrtc transport--- name: ${roomList.get(socket.room_id).getPeers().get(socket.id).name}`)
        try {
            const {
                params
            } = await roomList.get(socket.room_id).createWebRtcTransport(socket.id);

            callback(params);
        } catch (err) {
            console.error(err);
            callback({
                error: err.message
            });
        }
    });

    socket.on('connectTransport', async ({
        transport_id,
        dtlsParameters
    }, callback) => {
        console.log(`---connect transport--- name: ${roomList.get(socket.room_id).getPeers().get(socket.id).name}`)
        if (!roomList.has(socket.room_id)) return
        await roomList.get(socket.room_id).connectPeerTransport(socket.id, transport_id, dtlsParameters)
        
        callback('success')
    })

    socket.on('produce', async ({
        kind,
        rtpParameters,
        producerTransportId
    }, callback) => {
        
        if(!roomList.has(socket.room_id)) {
            return callback({error: 'not is a room'})
        }

        let producer_id = await roomList.get(socket.room_id).produce(socket.id, producerTransportId, rtpParameters, kind)
        console.log(`---produce--- type: ${kind} name: ${roomList.get(socket.room_id).getPeers().get(socket.id).name} id: ${producer_id}`)
        callback({
            producer_id
        })
    })

    socket.on('consume', async ({
        consumerTransportId,
        producerId,
        rtpCapabilities
    }, callback) => {
        //TODO null handling
        let params = await roomList.get(socket.room_id).consume(socket.id, consumerTransportId, producerId, rtpCapabilities)
        
        console.log(`---consuming--- name: ${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name} prod_id:${producerId} consumer_id:${params.id}`)
        callback(params)
    })

    socket.on('resume', async (data, callback) => {

        await consumer.resume();
        callback();
    });

    socket.on('getMyRoomInfo', (_, cb) => {
        cb(roomList.get(socket.room_id).toJson())
    })

    socket.on('disconnect', () => {
        console.log(`---disconnect--- name: ${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`)
        if (!socket.room_id) return
        roomList.get(socket.room_id).removePeer(socket.id)
    })

    socket.on('producerClosed', ({
        producer_id
    }) => {
        console.log(`---producer close--- name: ${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`)
        roomList.get(socket.room_id).closeProducer(socket.id, producer_id)
    })

    socket.on('exitRoom', async (_, callback) => {
        console.log(`---exit room--- name: ${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`)
        if (!roomList.has(socket.room_id)) {
            callback({
                error: 'not currently in a room'
            })
            return
        }
        // close transports
        await roomList.get(socket.room_id).removePeer(socket.id)
        if (roomList.get(socket.room_id).getPeers().size === 0) {
            roomList.delete(socket.room_id)
            console.log(`DESTROYED: ${socket.room_id}`);
        }

        socket.room_id = null


        callback('successfully exited room')
    })
})

function room() {
    return Object.values(roomList).map(r => {
        return {
            router: r.router.id,
            peers: Object.values(r.peers).map(p => {
                return {
                    name: p.name,
                }
            }),
            id: r.id
        }
    })
}
