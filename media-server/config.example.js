const os = require('os')

module.exports = {
    // URL: 143.248.136.68:8080

    // for media server
    listenIp: '0.0.0.0',
    listenPort: 8080,
    sslCrt: '../ssl/cert.pem',
    sslKey: '../ssl/key.pem',
    moderatorHostname: '',  // empty if you run moderator on the same machine
    moderatorPort: '8002',  // should be the same as listenPort in '../moderator/config.js'
    
    summaryHost: '127.0.0.1', // edit this to your summaryhost

    mediasoup: {
      // Worker settings
      numWorkers : Object.keys(os.cpus()).length,
      worker: {
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
        logLevel: 'warn',
        logTags: [
          'info',
          'ice',
          'dtls',
          'rtp',
          'srtp',
          'rtcp',
          // 'rtx',
          // 'bwe',
          // 'score',
          // 'simulcast',
          // 'svc'
        ],
      },
      // Router settings
      router: {
        mediaCodecs:
          [
            {
              kind: 'audio',
              mimeType: 'audio/opus',
              clockRate: 48000,
              channels: 2
            },
            {
              kind: 'video',
              mimeType: 'video/VP8',
              clockRate: 90000,
              parameters:
                {
                  'x-google-start-bitrate': 1000
                }
            },
          ]
      },
    // WebRtcTransport settings
    webRtcTransport: {
        listenIps: [
          {
            ip: '0.0.0.0',      
            announcedIp:'143.248.136.68'  // My public IP address (CPS)
            // announcedIp:'127.0.0.1' // replace by public IP address
          }
        ],
        maxIncomingBitrate: 1500000,
        initialAvailableOutgoingBitrate: 1000000
    },
    }
  };
  
