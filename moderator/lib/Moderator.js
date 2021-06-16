const mediasoupClient = require("mediasoup-client");
const { createWorker, AiortcMediaStream: MediaStream } = require("mediasoup-client-aiortc");

const mediaType = {
  audio: "audioType",
  video: "videoType",
  screen: "screenType",
};
const _EVENTS = {
  exitRoom: "exitRoom",
  openRoom: "openRoom",
  startVideo: "startVideo",
  stopVideo: "stopVideo",
  startAudio: "startAudio",
  stopAudio: "stopAudio",
  startScreen: "startScreen",
  stopScreen: "stopScreen",
};

module.exports = class Moderator {
  constructor(socket, room_id, room_secret, successCallback) {
    this.name = "Moderator";
    this.socket = socket;
    this.room_id = room_id;
    this.room_secret = room_secret;

    this.producerTransport = null;
    this.consumerTransport = null;
    this.device = null;

    this.consumers = new Map();
    this.producers = new Map();

    /**
     * map that contains a mediatype as key and producer_id as value
     */
    this.producerLabel = new Map();

    this._isOpen = false;
    this.eventListeners = new Map();
    Object.keys(_EVENTS).forEach(
      function (evt) {
        this.eventListeners.set(evt, []);
      }.bind(this)
    );

    this.createRoom(room_id).then(
      async function () {
        await this.join(this.name, room_id, room_secret);
        this.initSockets();
        this._isOpen = true;
        successCallback();
      }.bind(this)
    );
  }

  ////////// INIT /////////

  async createRoom(room_id) {
    await this.socket
      .request("createRoom", {
        room_id,
      })
      .catch((err) => {
        console.log(err);
      });
  }

  async join(name, room_id, room_secret) {
    socket
      .request("moderatorJoin", {
        name,
        room_id,
        room_secret,
      })
      .then(
        async function (e) {
          console.log(e);

          let wrtcWorker = await createWorker({ logLevel: "debug" });
          this.worker = wrtcWorker;

          const data = await this.socket.request("getRouterRtpCapabilities");
          let device = await this.loadDevice(data);
          this.device = device;

          await this.initTransports(device);
          this.socket.emit("getProducers");
        }.bind(this)
      )
      .catch((e) => {
        console.log(e);
      });
  }

  async loadDevice(routerRtpCapabilities) {
    let device;
    try {
      device = new mediasoupClient.Device({
        handlerFactory: this.worker.createHandlerFactory(),
      });
    } catch (error) {
      if (error.name === "UnsupportedError") {
        console.error("browser not supported");
      }
      console.error(error);
    }
    await device.load({
      routerRtpCapabilities,
    });
    return device;
  }

  async initTransports(device) {
    // init producerTransport
    {
      const data = await this.socket.request("createWebRtcTransport", {
        forceTcp: false,
        rtpCapabilities: device.rtpCapabilities,
      });
      if (data.error) {
        console.error(data.error);
        return;
      }

      this.producerTransport = device.createSendTransport(data);

      this.producerTransport.on(
        "connect",
        async function ({ dtlsParameters }, callback, errback) {
          this.socket
            .request("connectTransport", {
              dtlsParameters,
              transport_id: data.id,
            })
            .then(callback)
            .catch(errback);
        }.bind(this)
      );

      this.producerTransport.on(
        "produce",
        async function ({ kind, rtpParameters }, callback, errback) {
          try {
            const { producer_id } = await this.socket.request("produce", {
              producerTransportId: this.producerTransport.id,
              kind,
              rtpParameters,
            });
            callback({
              id: producer_id,
            });
          } catch (err) {
            errback(err);
          }
        }.bind(this)
      );

      this.producerTransport.on(
        "connectionstatechange",
        function (state) {
          switch (state) {
            case "connecting":
              break;

            case "connected":
              //localVideo.srcObject = stream
              break;

            case "failed":
              this.producerTransport.close();
              break;

            default:
              break;
          }
        }.bind(this)
      );
    }

    // init consumerTransport
    {
      const data = await this.socket.request("createWebRtcTransport", {
        forceTcp: false,
      });
      if (data.error) {
        console.error(data.error);
        return;
      }

      // only one needed
      this.consumerTransport = device.createRecvTransport(data);
      this.consumerTransport.on(
        "connect",
        function ({ dtlsParameters }, callback, errback) {
          this.socket
            .request("connectTransport", {
              transport_id: this.consumerTransport.id,
              dtlsParameters,
            })
            .then(callback)
            .catch(errback);
        }.bind(this)
      );

      this.consumerTransport.on(
        "connectionstatechange",
        async function (state) {
          switch (state) {
            case "connecting":
              break;

            case "connected":
              //remoteVideo.srcObject = await stream;
              //await socket.request('resume');
              break;

            case "failed":
              this.consumerTransport.close();
              break;

            default:
              break;
          }
        }.bind(this)
      );
    }
  }

  initSockets() {
    this.socket.on(
      "consumerClosed",
      function ({ consumer_id }) {
        console.log("closing consumer:", consumer_id);
        this.removeConsumer(consumer_id);
      }.bind(this)
    );

    /**
     * data: [ {
     *  producer_id:
     *  producer_socket_id:
     *  producer_name:
     * }]
     */
    this.socket.on(
      "newProducers",
      async function (data) {
        console.log("new producers", data);
        for (let {
          producer_id,
          producer_socket_id,
          producer_name,
          kind,
        } of data) {
          if (kind === "audio") {
            // Consume only audio for now.
            await this.consume(producer_id, producer_socket_id, producer_name);
          }
        }
      }.bind(this)
    );

    this.socket.on(
      "disconnect",
      function () {
        this.exit(true);
      }.bind(this)
    );
  }

  //////// MAIN FUNCTIONS /////////////

  async produce(type, deviceId = null) {
    let mediaConstraints = {};
    let audio = false;
    let screen = false;
    switch (type) {
      case mediaType.audio:
        mediaConstraints = {
          audio: {
            deviceId: deviceId,
          },
          video: false,
        };
        audio = true;
        break;
      case mediaType.video:
        mediaConstraints = {
          audio: false,
          video: {
            width: {
              min: 640,
              ideal: 1920,
            },
            height: {
              min: 400,
              ideal: 1080,
            },
            deviceId: deviceId,
            /*aspectRatio: {
                            ideal: 1.7777777778
                        }*/
          },
        };
        break;
      case mediaType.screen:
        mediaConstraints = false;
        screen = true;
        break;
      default:
        return;
        break;
    }
    if (!this.device.canProduce("video") && !audio) {
      console.error("cannot produce video");
      return;
    }
    if (this.producerLabel.has(type)) {
      console.log("producer already exists for this type " + type);
      return;
    }
    console.log("mediacontraints:", mediaConstraints);
    let stream;
    try {
      stream = screen
        ? await this.worker.getDisplayMedia()
        : await this.worker.getUserMedia(mediaConstraints);
      console.log(this.worker.getSupportedConstraints());

      const track = audio
        ? stream.getAudioTracks()[0]
        : stream.getVideoTracks()[0];
      const params = {
        track,
      };
      if (!audio && !screen) {
        params.encodings = [
          {
            rid: "r0",
            maxBitrate: 100000,
            //scaleResolutionDownBy: 10.0,
            scalabilityMode: "S1T3",
          },
          {
            rid: "r1",
            maxBitrate: 300000,
            scalabilityMode: "S1T3",
          },
          {
            rid: "r2",
            maxBitrate: 900000,
            scalabilityMode: "S1T3",
          },
        ];
        params.codecOptions = {
          videoGoogleStartBitrate: 1000,
        };
      }
      let producer = await this.producerTransport.produce(params);

      console.log("producer", producer);

      this.producers.set(producer.id, producer);

      // Do something (or don't)
      // with the stream
      // created by moderator

      producer.on("trackended", () => {
        this.closeProducer(type);
      });

      producer.on("transportclose", () => {
        console.log("producer transport closed");
        this.closeProducer(type);
      });

      producer.on("close", () => {
        console.log("closing producer");
        this.closeProducer(type);
      });

      this.producerLabel.set(type, producer.id);

      switch (type) {
        case mediaType.audio:
          this.event(_EVENTS.startAudio);
          break;
        case mediaType.video:
          this.event(_EVENTS.startVideo);
          break;
        case mediaType.screen:
          this.event(_EVENTS.startScreen);
          break;
        default:
          return;
      }
    } catch (err) {
      console.log(err);
    }
  }

  async consume(producer_id, producer_socket_id, producer_name) {
    //let info = await roomInfo()

    this.getConsumeStream(producer_id).then(
      function ({ consumer, stream, kind }) {
        this.consumers.set(consumer.id, consumer);

        if (kind === "audio") {
          // TODO:
          // attach
          // transcription
          // and summary
          // capabilities
        } else {
          // Do something
          // with a
          // video stream
        }

        consumer.on(
          "trackended",
          function () {
            this.removeConsumer(consumer.id);
          }.bind(this)
        );
        consumer.on(
          "transportclose",
          function () {
            this.removeConsumer(consumer.id);
          }.bind(this)
        );
      }.bind(this)
    );
  }

  async getConsumeStream(producerId) {
    const { rtpCapabilities } = this.device;
    const data = await this.socket.request("consume", {
      rtpCapabilities,
      consumerTransportId: this.consumerTransport.id, // might be
      producerId,
    });
    const { id, kind, rtpParameters } = data;

    let codecOptions = {};
    const consumer = await this.consumerTransport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
      codecOptions,
    });
    const stream = new MediaStream();
    stream.addTrack(consumer.track);
    return {
      consumer,
      stream,
      kind,
    };
  }

  closeProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log("there is no producer for this type " + type);
      return;
    }
    let producer_id = this.producerLabel.get(type);
    console.log(producer_id);
    this.socket.emit("producerClosed", {
      producer_id,
    });
    this.producers.get(producer_id).close();
    this.producers.delete(producer_id);
    this.producerLabel.delete(type);

    // Clear any
    // resources
    // used when
    // started producing

    switch (type) {
      case mediaType.audio:
        this.event(_EVENTS.stopAudio);
        break;
      case mediaType.video:
        this.event(_EVENTS.stopVideo);
        break;
      case mediaType.screen:
        this.event(_EVENTS.stopScreen);
        break;
      default:
        return;
        break;
    }
  }

  pauseProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log("there is no producer for this type " + type);
      return;
    }
    let producer_id = this.producerLabel.get(type);
    this.producers.get(producer_id).pause();
  }

  resumeProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log("there is no producer for this type " + type);
      return;
    }
    let producer_id = this.producerLabel.get(type);
    this.producers.get(producer_id).resume();
  }

  removeConsumer(consumer_id) {
    // TODO:
    // clear any
    // resources
    // used when
    // started consuming

    this.consumers.delete(consumer_id);
  }

  exit(offline = false) {
    let clean = function () {
      this._isOpen = false;
      this.consumerTransport.close();
      this.producerTransport.close();
      this.socket.off("disconnect");
      this.socket.off("newProducers");
      this.socket.off("consumerClosed");
    }.bind(this);

    if (!offline) {
      this.socket
        .request("exitRoom")
        .then((e) => console.log(e))
        .catch((e) => console.warn(e))
        .finally(
          function () {
            clean();
          }.bind(this)
        );
    } else {
      clean();
    }

    this.event(_EVENTS.exitRoom);
  }

  ///////  HELPERS //////////

  async roomInfo() {
    let info = await socket.request("getMyRoomInfo");
    return info;
  }

  static get mediaType() {
    return mediaType;
  }

  event(evt) {
    if (this.eventListeners.has(evt)) {
      this.eventListeners.get(evt).forEach((callback) => callback());
    }
  }

  on(evt, callback) {
    this.eventListeners.get(evt).push(callback);
  }

  //////// GETTERS ////////

  isOpen() {
    return this._isOpen;
  }

  static get EVENTS() {
    return _EVENTS;
  }
};
