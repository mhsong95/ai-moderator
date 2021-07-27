// recognition.js
// Streams audio into a moderator server (socket.io server).
// Defines methods and events to stream audio to be transcribed by
// Google Cloud Speech-to-text API.
// Reference: https://stackoverflow.com/questions/50976084/how-do-i-stream-live-audio-from-the-browser-to-google-cloud-speech-via-socket-io

// TODO: figure out a way to get the right host name.
const moderatorSocket = io(`https://${moderator_hostname}:${moderator_port}/`, {
  query: {
    room_id: room_id,
    name: user_name,
  },
});

var lastStamp;

rc.on(RoomClient.EVENTS.startAudio, () => {
  moderatorSocket.emit("startRecognition");
  let producer_id = rc.producerLabel.get(mediaType.audio);
  let track = rc.producers.get(producer_id).track;
  startRecord(track);
});

function startRecord(track) {
  let stream = new MediaStream([track]);
  let mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start(1000); // 1000 - the number of milliseconds to record into each Blob
  let timestamp = Date.now();
  lastStamp = timestamp;
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      moderatorSocket.emit("binaryAudioData", event.data, timestamp);
      let now = Date.now();
      if (timestamp + 30000 < now) {
        mediaRecorder.stop();
        moderatorSocket.emit("requestSTT", timestamp);
        startRecord(track);
      }
    }
  };
}

rc.on(RoomClient.EVENTS.stopAudio, () => {
  moderatorSocket.emit("endRecognition");
  moderatorSocket.emit("requestSTT", lastStamp);
  closeAll();
});

// Helper functions
/**
 * Stops recording and closes everything down. Runs on error or on stop.
 */
function closeAll() {
  // Clear the listeners (prevents issue if opening and closing repeatedly)
  moderatorSocket.off("recognitionError");

  // if (processor) {
  //   if (input) {
  //     try {
  //       input.disconnect(processor);
  //     } catch (error) {
  //       console.warn("Attempt to disconnect input failed.");
  //     }
  //   }
  //   processor.disconnect(context.destination);
  // }
  // if (context) {
  //   context.close().then(function () {
  //     input = null;
  //     processor = null;
  //     context = null;
  //     AudioContext = null;
  //   });
  // }
}
