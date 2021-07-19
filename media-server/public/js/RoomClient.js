const mediaType = {
    audio: 'audioType',
    video: 'videoType',
    screen: 'screenType'
}
const _EVENTS = {
    exitRoom: 'exitRoom',
    openRoom: 'openRoom',
    startVideo: 'startVideo',
    pauseVideo: 'pauseVideo',
    resumeVideo: 'resumeVideo',
    stopVideo: 'stopVideo',
    startAudio: 'startAudio',
    pauseAudio: 'pauseAudio',
    resumeAudio: 'resumeAudio',
    stopAudio: 'stopAudio',
    startScreen: 'startScreen',
    pauseScreen: 'pauseScreen',
    resumeScreen: 'resumeScreen',
    stopScreen: 'stopScreen'
}

class RoomClient {

    constructor (localMediaEl, remoteMediaEl, mediasoupClient, socket, room_id, name, successCallback) {
        this.name = name
        this.localMediaEl = localMediaEl
        this.remoteMediaEl = remoteMediaEl;
        this.mediasoupClient = mediasoupClient

        this.socket = socket
        this.producerTransport = null
        this.consumerTransport = null
        this.device = null
        this.room_id = room_id

        this.consumers = new Map()
        this.producers = new Map()

        this.userLog = {}

        /**
         * map that contains a mediatype as key and producer_id as value
         */
        this.producerLabel = new Map()

        this._isOpen = false
        this.eventListeners = new Map()
        Object.keys(_EVENTS).forEach(function (evt) {
            this.eventListeners.set(evt, [])
        }.bind(this))


        this.createRoom(room_id).then(async function () {
            await this.join(name, room_id)
            this.initSockets()
            this._isOpen = true
            successCallback()
        }.bind(this))




    }

    ////////// INIT /////////

    async createRoom(room_id) {
        await this.socket.request('createRoom', {
            room_id
        }).catch(err => {
            console.log(err)
        })
    }

    async join(name, room_id) {
        this.socket.request('join', {
            name,
            room_id,
            room_name
        }).then(async function (e) {
            console.log(e)
            const data = await this.socket.request('getRouterRtpCapabilities');
            let device = await this.loadDevice(data)
            this.device = device
            await this.initTransports(device)
            this.socket.emit('getProducers')
        }.bind(this)).catch(e => {
            console.log(e)
        })
    }

    async loadDevice(routerRtpCapabilities) {
        let device
        try {
            device = new this.mediasoupClient.Device();
        } catch (error) {
            if (error.name === 'UnsupportedError') {
                console.error('browser not supported');
            }
            console.error(error)
        }
        await device.load({
            routerRtpCapabilities
        })
        return device

    }

    async initTransports(device) {

        // init producerTransport
        {
            const data = await this.socket.request('createWebRtcTransport', {
                forceTcp: false,
                rtpCapabilities: device.rtpCapabilities,
            })
            if (data.error) {
                console.error(data.error);
                return;
            }

            this.producerTransport = device.createSendTransport(data);

            this.producerTransport.on('connect', async function ({
                dtlsParameters
            }, callback, errback) {
                this.socket.request('connectTransport', {
                    dtlsParameters,
                    transport_id: data.id
                })
                    .then(callback)
                    .catch(errback)
            }.bind(this));

            this.producerTransport.on('produce', async function ({
                kind,
                rtpParameters
            }, callback, errback) {
                try {
                    const {
                        producer_id
                    } = await this.socket.request('produce', {
                        producerTransportId: this.producerTransport.id,
                        kind,
                        rtpParameters,
                    });
                    callback({
                        id: producer_id
                    });
                } catch (err) {
                    errback(err);
                }
            }.bind(this))

            this.producerTransport.on('connectionstatechange', function (state) {
                switch (state) {
                    case 'connecting':

                        break;

                    case 'connected':
                        //localVideo.srcObject = stream
                        break;

                    case 'failed':
                        this.producerTransport.close();
                        break;

                    default:
                        break;
                }
            }.bind(this));
        }

        // init consumerTransport
        {
            const data = await this.socket.request('createWebRtcTransport', {
                forceTcp: false,
            });
            if (data.error) {
                console.error(data.error);
                return;
            }

            // only one needed
            this.consumerTransport = device.createRecvTransport(data);
            this.consumerTransport.on('connect', function ({
                dtlsParameters
            }, callback, errback) {
                this.socket.request('connectTransport', {
                    transport_id: this.consumerTransport.id,
                    dtlsParameters
                })
                    .then(callback)
                    .catch(errback);
            }.bind(this));

            this.consumerTransport.on('connectionstatechange', async function (state) {
                switch (state) {
                    case 'connecting':
                        break;

                    case 'connected':
                        //remoteVideo.srcObject = await stream;
                        //await socket.request('resume');
                        break;

                    case 'failed':
                        this.consumerTransport.close();
                        break;

                    default:
                        break;
                }
            }.bind(this));
        }

    }

    initSockets() {
        this.socket.on('consumerClosed', function ({
            consumer_id
        }) {
            console.log('closing consumer:', consumer_id)
            this.removeConsumer(consumer_id)
        }.bind(this))

        /**
         * data: [ {
         *  producer_id:
         *  producer_socket_id:
         *  producer_name:
         * }]
         */
        this.socket.on('newProducers', async function (data) {
            console.log('new producers', data)
            for (let {
                producer_id,
                producer_socket_id,
                producer_name
            } of data) {
                await this.consume(producer_id, producer_socket_id, producer_name)
            }
        }.bind(this))

        this.socket.on('disconnect', function () {
            this.exit(true)
        }.bind(this))


    }




    //////// MAIN FUNCTIONS /////////////


    async produce(type, deviceId = null) {
        let mediaConstraints = {}
        let audio = false
        let screen = false
        switch (type) {
            case mediaType.audio:
                mediaConstraints = {
                    audio: {
                        deviceId: deviceId
                    },
                    video: false
                }
                audio = true
                break
            case mediaType.video:
                mediaConstraints = {
                    audio: false,
                    video: {
                        width: {
                            min: 640,
                            ideal: 1920
                        },
                        height: {
                            min: 400,
                            ideal: 1080
                        },
                        deviceId: deviceId
                        /*aspectRatio: {
                            ideal: 1.7777777778
                        }*/
                    }
                }
                break
            case mediaType.screen:
                mediaConstraints = false
                screen = true
                break;
            default:
                return
                break;
        }
        if (!this.device.canProduce('video') && !audio) {
            console.error('cannot produce video');
            return;
        }
        if (this.producerLabel.has(type)) {
            console.log('producer already exists for this type ' + type)
            return
        }
        console.log('mediacontraints:', mediaConstraints)
        let stream;
        try {
            stream = screen ? await navigator.mediaDevices.getDisplayMedia() : await navigator.mediaDevices.getUserMedia(mediaConstraints)
            console.log(navigator.mediaDevices.getSupportedConstraints())


            const track = audio ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0]
            const params = {
                track
            };
            if (!audio && !screen) {
                params.encodings = [{
                    rid: 'r0',
                    maxBitrate: 100000,
                    //scaleResolutionDownBy: 10.0,
                    scalabilityMode: 'S1T3'
                },
                {
                    rid: 'r1',
                    maxBitrate: 300000,
                    scalabilityMode: 'S1T3'
                },
                {
                    rid: 'r2',
                    maxBitrate: 900000,
                    scalabilityMode: 'S1T3'
                }
                ];
                params.codecOptions = {
                    videoGoogleStartBitrate: 1000
                };
            }
            console.log("produceTransport="+this.producerTransport+", closed()="+this.producerTransport._closed);
            if (this.producerTransport._closed){
                await this.initTransports(this.device)
            }
            let producer = await this.producerTransport.produce(params)

            console.log('producer', producer)

            this.producers.set(producer.id, producer)

            let elem
            if (!audio) {
                elem = document.createElement('video')
                elem.srcObject = stream
                elem.id = producer.id
                elem.playsinline = false
                elem.autoplay = true
                elem.className = "vid"
                this.attachVideo(this.localMediaEl, elem);
                // this.localMediaEl.appendChild(elem)
            } else {
                this.attachAudio(this.localMediaEl, null);
            }

            producer.on('trackended', () => {
                this.closeProducer(type)
            })

            producer.on('transportclose', () => {
                console.log('producer transport closed')
                this.closeProducer(type);
            })

            producer.on('close', () => {
                console.log('closing producer')
                this.closeProducer(type);
            })

            this.producerLabel.set(type, producer.id)

            switch (type) {
                case mediaType.audio:
                    this.event(_EVENTS.startAudio)
                    break
                case mediaType.video:
                    this.event(_EVENTS.startVideo)
                    break
                case mediaType.screen:
                    this.event(_EVENTS.startScreen)
                    break;
                default:
                    return
                    break;
            }
        } catch (err) {
            console.log(err)
        }
    }

    async consume(producer_id, producer_socket_id, producer_name) {

        //let info = await roomInfo()

        this.getConsumeStream(producer_id).then(function ({
            consumer,
            stream,
            kind
        }) {

            this.consumers.set(consumer.id, consumer)

            let mediaContainer = document.getElementById(producer_socket_id);
            let elem;
            if (kind === 'video') {
                elem = document.createElement('video')
                elem.srcObject = stream
                elem.id = consumer.id
                elem.playsinline = false
                elem.autoplay = true
                elem.className = "vid"

                if (!mediaContainer) {
                    mediaContainer = this.createMediaContainer(producer_socket_id, elem, null, producer_name);
                    this.remoteMediaEl.appendChild(mediaContainer);
                } else {
                    this.attachVideo(mediaContainer, elem);
                }
            } else {
                elem = document.createElement('audio')
                elem.srcObject = stream
                elem.id = consumer.id
                elem.playsinline = false
                elem.autoplay = true

                if (!mediaContainer) {
                    mediaContainer = this.createMediaContainer(producer_socket_id, null, elem, producer_name);
                    this.remoteMediaEl.appendChild(mediaContainer);
                } else {
                    this.attachAudio(mediaContainer, elem);
                }
            }

            consumer.on('trackended', function () {
                this.removeConsumer(consumer.id)
            }.bind(this))
            consumer.on('transportclose', function () {
                this.removeConsumer(consumer.id)
            }.bind(this))

        }.bind(this))
    }

    async getConsumeStream(producerId) {
        const {
            rtpCapabilities
        } = this.device
        const data = await this.socket.request('consume', {
            rtpCapabilities,
            consumerTransportId: this.consumerTransport.id, // might be 
            producerId
        });
        const {
            id,
            kind,
            rtpParameters,
        } = data;

        let codecOptions = {};
        const consumer = await this.consumerTransport.consume({
            id,
            producerId,
            kind,
            rtpParameters,
            codecOptions,
        })
        const stream = new MediaStream();
        stream.addTrack(consumer.track);
        return {
            consumer,
            stream,
            kind
        }
    }

    closeProducer(type) {
        if (!this.producerLabel.has(type)) {
            console.log('there is no producer for this type ' + type)
            return
        }
        let producer_id = this.producerLabel.get(type)
        console.log(producer_id)
        this.socket.emit('producerClosed', {
            producer_id
        })
        this.producers.get(producer_id).close()
        this.producers.delete(producer_id)
        this.producerLabel.delete(type)

        if (type !== mediaType.audio) {
            let elem = document.getElementById(producer_id)
            elem.srcObject.getTracks().forEach(function (track) {
                track.stop()
            })
            let mediaContainer = elem.parentNode;
            mediaContainer.removeChild(elem);
            this.attachVideo(mediaContainer, document.createElement("video"));
        } else {
            for (let childNode of Array.from(this.localMediaEl.childNodes)) {
                if (childNode.tagName === "BUTTON") {
                    this.localMediaEl.removeChild(childNode);
                    break;
                }
            }
        }

        switch (type) {
            case mediaType.audio:
                this.event(_EVENTS.stopAudio)
                break
            case mediaType.video:
                this.event(_EVENTS.stopVideo)
                break
            case mediaType.screen:
                this.event(_EVENTS.stopScreen)
                break;
            default:
                return
                break;
        }

    }

    pauseProducer(type) {
        if (!this.producerLabel.has(type)) {
            console.log('there is no producer for this type ' + type)
            return
        }
        let producer_id = this.producerLabel.get(type)
        this.producers.get(producer_id).pause()

        switch (type) {
            case mediaType.audio:
                this.event(_EVENTS.pauseAudio);
                break;
            case mediaType.video:
                this.event(_EVENTS.pauseVideo);
                break;
            case mediaType.screen:
                this.event(_EVENTS.pauseScreen);
                break;
            default:
                return;
        }
    }

    resumeProducer(type) {
        if (!this.producerLabel.has(type)) {
            console.log('there is no producer for this type ' + type)
            return
        }
        let producer_id = this.producerLabel.get(type)
        this.producers.get(producer_id).resume()

        switch (type) {
            case mediaType.audio:
                this.event(_EVENTS.resumeAudio);
                break;
            case mediaType.video:
                this.event(_EVENTS.resumeVideo);
                break;
            case mediaType.screen:
                this.event(_EVENTS.resumeScreen);
                break;
            default:
                return;
        }
    }

    removeConsumer(consumer_id) {
        let elem = document.getElementById(consumer_id)
        elem.srcObject.getTracks().forEach(function (track) {
            track.stop()
        })

        let type = elem.tagName;
        let mediaContainer = elem.parentNode;
        mediaContainer.removeChild(elem);

        if (type === "VIDEO") {
            if (mediaContainer.childNodes.length === 1) {
                mediaContainer.parentNode.removeChild(mediaContainer);
            } else {
                this.attachVideo(mediaContainer, document.createElement("video"));
            }
        } else {
            for (let childNode of Array.from(mediaContainer.childNodes)) {
                if (childNode.tagName === "BUTTON") {
                    mediaContainer.removeChild(childNode);
                } else if (childNode.tagName === "VIDEO") {
                    if (!childNode.id) {
                        mediaContainer.removeChild(childNode);
                    }
                }
            }
            if (mediaContainer.childNodes.length === 1) {
                mediaContainer.parentNode.removeChild(mediaContainer);
            }
        }

        this.consumers.delete(consumer_id)
    }

    exit(offline = false) {

        let clean = function () {
            this._isOpen = false
            this.consumerTransport.close()
            this.producerTransport.close()
            this.socket.off('disconnect')
            this.socket.off('newProducers')
            this.socket.off('consumerClosed')
        }.bind(this)

        if (!offline) {
            this.socket.request('exitRoom').then(e => console.log(e)).catch(e => console.warn(e)).finally(function () {
                clean()
            }.bind(this))
        } else {
            clean()
        }

        this.event(_EVENTS.exitRoom)

    }

    ///////  HELPERS //////////

    async roomInfo() {
        let info = await this.socket.request('getMyRoomInfo')
        return info
    }

    static get mediaType() {
        return mediaType
    }

    event(evt) {
        if (this.eventListeners.has(evt)) {
            this.eventListeners.get(evt).forEach(callback => callback())
        }
    }

    on(evt, callback) {
        this.eventListeners.get(evt).push(callback)
    }

    createMediaContainer(socket_id, videoElem, audioElem, name) {
        let container = document.createElement("div");
        container.className = "video-container";
        container.id = socket_id;

        if (videoElem === null) {
            videoElem = document.createElement("video");
        }

        let nameOverlayElem = document.createElement("p");
        nameOverlayElem.className = "name-overlay";
        nameOverlayElem.textContent = name;
        container.appendChild(nameOverlayElem);

        this.attachVideo(container, videoElem);
        if (audioElem !== null) {
            this.attachAudio(container, audioElem);
        }

        return container;
    }

    attachVideo(mediaContainer, videoElem) {
        let oldVideos = mediaContainer.getElementsByTagName("video");
        if (oldVideos.length > 0) {
            for (let elem of oldVideos) {
                mediaContainer.removeChild(elem);
            }
        }

        mediaContainer.appendChild(videoElem);
    }

    attachAudio(mediaContainer, audioElem) {
        let muteButtonElem = document.createElement("button");
        muteButtonElem.className = "control-overlay";

        let buttonImg = document.createElement("img");
        buttonImg.src = "/img/unmuted.png";
        buttonImg.alt = "mute";
        muteButtonElem.appendChild(buttonImg);
        muteButtonElem.setAttribute("muted", "unmuted");

        muteButtonElem.onclick = (ev) => {
            if (muteButtonElem.getAttribute("muted") === "unmuted") {
                buttonImg.src = "/img/muted.png";
                buttonImg.alt = "unmute";

                if (mediaContainer.id === this.socket.id) {
                    this.pauseProducer(mediaType.audio);
                    this.addUserLog(Date.now(), 'Mute my audio\n');
                } else {
                    if (audioElem) {
                        audioElem.muted = true;
                        this.addUserLog(Date.now(), "Mute other's audio: "+mediaContainer.id+"\n");
                    }
                }

                muteButtonElem.setAttribute("muted", "muted");
            } else {
                buttonImg.src = "/img/unmuted.png";
                buttonImg.alt = "mute";

                if (mediaContainer.id === this.socket.id) {
                    this.resumeProducer(mediaType.audio);
                    this.addUserLog(Date.now(), 'Unmute my audio\n');
                } else {
                    if (audioElem) {
                        audioElem.muted = false;
                        this.addUserLog(Date.now(), "Unmute other's audio: "+mediaContainer.id+"\n");
                    }
                }

                muteButtonElem.setAttribute("muted", "unmuted");
            }
        }

        mediaContainer.appendChild(muteButtonElem);
        if (audioElem) {
            mediaContainer.appendChild(audioElem);
        }
    }

    updateParagraph(paragraph, timestamp, editor) {
        console.log("rc.updateParagraph")
        console.log(editor)
        moderatorSocket.emit("updateParagraph", paragraph, timestamp, editor);
    }

    updateSummary(type, content, timestamp) {
        console.log("rc.updateSummary")
        moderatorSocket.emit("updateSummary", type, content, timestamp);
    }

    addUserLog(timestamp, text) {
        let userLog = this.userLog;
        let user_name = this.name;
        userLog[timestamp] = '(' + timestamp + ') ' + text;
        console.log(Object.keys(userLog).length);
        if (Object.keys(userLog).length > 0) {
            this.socket.request('saveLog', { room_name, user_name, userLog });
            this.userLog = {}
        }
    }

    //////// GETTERS ////////

    isOpen() {
        return this._isOpen
    }

    static get EVENTS() {
        return _EVENTS
    }
}