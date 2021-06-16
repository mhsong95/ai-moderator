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

rc.on(RoomClient.EVENTS.startAudio, () => {
  let producer_id = rc.producerLabel.get(mediaType.audio);
  let track = rc.producers.get(producer_id).track;

  let stream = new MediaStream([track]);
  AudioStreamer.initRecording(stream, 
    (data) => {
      console.log(data);
    }, 
    (err) => {
      console.log(err);
    });

});

/*
rc.on(RoomClient.EVENTS.pauseAudio, () => {

});

rc.on(RoomClient.EVENTS.resumeAudio, () => {

});
*/

rc.on(RoomClient.EVENTS.stopAudio, () => {
  AudioStreamer.stopRecording();
});

// Stream Audio
let bufferSize = 2048,
  AudioContext,
  context,
  processor,
  input,
  globalStream;

let AudioStreamer = {
  /**
   * @param {function} onData Callback to run on data each time it's received
   * @param {function} onError Callback to run on an error if one is emitted.
   */
  initRecording: function (stream, onError) {
    moderatorSocket.emit("startRecognition");
    AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    processor = context.createScriptProcessor(bufferSize, 1, 1);
    processor.connect(context.destination);
    context.resume();

    globalStream = stream;
    input = context.createMediaStreamSource(stream);
    input.connect(processor);

    // TODO: use MediaRecorder API instead.
    processor.onaudioprocess = function (e) {
      microphoneProcess(e);
    };

    moderatorSocket.on("recognitionError", (error) => {
      if (onError) {
        onError("error");
      }
      // We don't want to emit another end stream event
      closeAll();
    });
  },

  stopRecording: function () {
    moderatorSocket.emit("endRecognition");
    closeAll();
  },
};

// Helper functions
/**
 * Processes microphone data into a data stream
 *
 * @param {object} e Input from the microphone
 */
function microphoneProcess(e) {
  var left = e.inputBuffer.getChannelData(0);
  var left16 = convertFloat32ToInt16(left);
  moderatorSocket.emit("binaryAudioData", left16);
}

/**
 * Converts a buffer from float32 to int16. Necessary for streaming.
 * sampleRateHertz of 1600.
 *
 * @param {object} buffer Buffer being converted
 */
function convertFloat32ToInt16(buffer) {
  let l = buffer.length;
  let buf = new Int16Array(l / 3);

  while (l--) {
    if (l % 3 === 0) {
      buf[l / 3] = buffer[l] * 0xffff;
    }
  }
  return buf.buffer;
}

/**
 * Stops recording and closes everything down. Runs on error or on stop.
 */
function closeAll() {
  // Clear the listeners (prevents issue if opening and closing repeatedly)
  // moderatorSocket.off("speechData");
  moderatorSocket.off("recognitionError");
  /*
  let tracks = globalStream ? globalStream.getTracks() : null;
  let track = tracks ? tracks[0] : null;
  if (track) {
    track.stop();
  }
  */

  if (processor) {
    if (input) {
      try {
        input.disconnect(processor);
      } catch (error) {
        console.warn("Attempt to disconnect input failed.");
      }
    }
    processor.disconnect(context.destination);
  }
  if (context) {
    context.close().then(function () {
      input = null;
      processor = null;
      context = null;
      AudioContext = null;
    });
  }
}
