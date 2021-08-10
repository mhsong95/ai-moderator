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

// Stream Audio
let bufferSize = 2048,
  AudioContext,
  context,
  processor,
  input,
  globalStream,
  producer_id,
  track,
  stream;

let mediaRecoder = null, currTimestamp = 0;

let AudioStreamer = {
  /**
   * @param {function} onData Callback to run on data each time it's received
   * @param {function} onError Callback to run on an error if one is emitted.
   */
  initRecording: function (stream, timestamp, onError) {
    // Use `AudioContext` to send audio data for MS STT
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
  },
};

/**
 * TODO(@anemoneflower): add comment
 */
let newMediaRecorder = null;
let newTimestamp = 0;
moderatorSocket.on("startNewRecord", (timestamp) => {
  // Use `MediaRecorder` to record webm file for Naver STT
  console.log("START NEW RECORD: ", timestamp, new Date(Number(timestamp)));
  if (!stream) {
    console.log("(speech.js - 'startNewRecord') No stream!!");
    return;
  }
  newMediaRecorder = new MediaRecorder(stream);
  newMediaRecorder.start(1000); // 1000 - the number of milliseconds to record into each Blob
  newTimestamp = timestamp;
  newMediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      moderatorSocket.emit("streamAudioData", event.data, timestamp);
    }
  };
})

/**
 * TODO(@anemoneflower): add comment
 */
moderatorSocket.on("stopCurrentRecord", () => {
  // Use `MediaRecorder` to record webm file for Naver STT
  console.log("STOP CURRENT RECORD: ", currTimestamp);

  if (mediaRecorder) {
    mediaRecorder.stop();
    mediaRecorder = null;
    currTimestamp = null;
  }

  mediaRecorder = newMediaRecorder;
  currTimestamp = newTimestamp;
})

/**
 * TODO(@anemoneflower): add comment
 * DESIGN: remove!!!!!!!!!!!!!!!!!!!!!!!
 */
moderatorSocket.on("restartRecord", () => {
  let timestamp = Date.now();
  console.log("RESTART RECORD", timestamp);
  closeAll();

  AudioStreamer.initRecording(stream, timestamp,
    (data) => {
      console.log(data);
    },
    (err) => {
      console.log(err);
    });
});

rc.on(RoomClient.EVENTS.startAudio, () => {
  console.log("RoomClient.EVENTS.startAudio");

  producer_id = rc.producerLabel.get(mediaType.audio);
  track = rc.producers.get(producer_id).track;
  stream = new MediaStream([track]);

  let timestamp = Date.now();

  // Use `MediaRecorder` to record webm file for Naver STT
  console.log("START RECORD: ", timestamp);
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start(1000); // 1000 - the number of milliseconds to record into each Blob
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      moderatorSocket.emit("streamAudioData", event.data, timestamp);
    }
  };

  moderatorSocket.emit("startRecognition", timestamp);

  AudioStreamer.initRecording(stream, timestamp,
    (data) => {
      console.log(data);
    },
    (err) => {
      console.log(err);
    });
});

rc.on(RoomClient.EVENTS.stopAudio, () => {
  AudioStreamer.stopRecording();
  closeAll();
});

//* Helper functions
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
  console.log("CLOSEALL");
  // Clear the listeners (prevents issue if opening and closing repeatedly)
  moderatorSocket.off("recognitionError");

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
  if (mediaRecorder) {
    mediaRecorder.stop();
    mediaRecorder = null;
  }

  producer_id = null;
  track = null;
  stream = null;
}
