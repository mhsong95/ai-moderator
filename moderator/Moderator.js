const io = require("socket.io-client");
const mediasoupClient = require("mediasoup-client");
const {
  version,
  createWorker,
  Worker,
  WorkerSettings,
  WorkerLogLevel,
  AiortcMediaStream,
  AiortcMediaStreamConstraints,
  AiortcMediaTrackConstraints 
} = require("mediasoup-client-aiortc");

(async () => {
  /*
  const socket = io("ws://localhost:3016/", {
    query: "Hi motherfucker",
  });
  socket.on("connect", () => {
    console.log(`Socket connected! ${socket.id}`);
  });
  */

  let worker = await createWorker({ logLevel: "debug"});
  let device = new mediasoupClient.Device({
    handlerFactory: worker.createHandlerFactory(),
  });

  console.log(device.handlerName);
  console.log(device);

  console.log(device.rtpCapabilities);

  worker.close();
  return;
})().then(() => {});