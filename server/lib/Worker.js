// Worker.js
// Defines functions to create and select a mediasoup worker.

const mediasoup = require("mediasoup");
const config = require("../config");

// all mediasoup workers
const workers = [];
let nextMediasoupWorkerIdx = 0;

module.exports = {
  createWorkers: async function () {
    let { numWorkers } = config.mediasoup;

    for (let i = 0; i < numWorkers; i++) {
      let worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
      });

      worker.on("died", () => {
        console.error(
          "mediasoup worker died, exiting in 2 seconds... [pid:%d]",
          worker.pid
        );
        setTimeout(() => process.exit(1), 2000);
      });
      workers.push(worker);

      // log worker resource usage
      /*setInterval(async () => {
            const usage = await worker.getResourceUsage();

            console.info('mediasoup Worker resource usage [pid:%d]: %o', worker.pid, usage);
        }, 120000);*/
    }
  },

  /**
   * Get next mediasoup Worker.
   */
  getMediasoupWorker: function () {
    const worker = workers[nextMediasoupWorkerIdx];

    if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;

    return worker;
  },
};
