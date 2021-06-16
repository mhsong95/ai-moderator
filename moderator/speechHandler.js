// speechHandler.js
// Defines event listeners for transcripting and summarizing user audio streams.
// References:
// https://github.com/googleapis/nodejs-speech/blob/master/samples/infiniteStreaming.js
// https://cloud.google.com/speech-to-text/docs/quickstart-client-libraries?hl=ko

const { Writable } = require("stream");
const axios = require("axios");
const { clerks } = require("./global");

// Google Cloud Speech-to-text client library
const speech = require("@google-cloud/speech");
const { projectId, keyFilename } = require("./config");
const speechClient = new speech.SpeechClient({ projectId, keyFilename });

module.exports = function (io, socket) {
  // Speech recognition options.
  // TODO: let user choose some of the configurations.
  const request = {
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: "en-US",
      enableAutomaticPunctuation: true, // Automatic punctuation
      /*
      speechContexts: [
        {
          phrases: ["hoful", "shwazil"],
        },
      ], // add your own speech context for better recognition
      */
    },
    interimResults: true,
  };

  // Variables for maintaining infinite stream of recognition.
  const streamingLimit = 290000; // streaming limit in ms. (~5 minutes)
  let recognizeStream = null;
  let restartCounter = 0;
  let audioInput = [];
  let lastAudioInput = [];
  let resultEndTime = 0;
  let isFinalEndTime = 0;
  let finalRequestEndTime = 0;
  let newStream = true;
  let bridgingOffset = 0;
  let lastTranscriptWasFinal = false;
  let restartTimeout = null;

  // Starts a new speech recognition stream
  function startStream() {
    console.log(`Recognition starting by ${socket.name} in ${socket.room_id}`);

    // Clear current audioInput (buffered audio)
    audioInput = [];
    // Initiate (reinitiate) a recognize stream.
    recognizeStream = speechClient
      .streamingRecognize(request)
      .on("error", (err) => {
        if (err.code === 11) {
          // special case: steaming limit reached => restart stream.
          restartStream();
        } else {
          console.error(
            "Error when processing audio: " +
              (err && err.code ? "Code: " + err.code + " " : "") +
              (err && err.details ? err.details : "")
          );
          socket.emit("recognitionError", err);
        }
      })
      .on("data", (data) => {
        speechCallback(data);
      });

    // Restart stream when it is about to exceed streamingLimit.
    restartTimeout = setTimeout(() => {
      restartStream();
    }, streamingLimit);
  }

  // Callback to be called when a response (transcript) arrives from API.
  const speechCallback = (data) => {
    let clerk = clerks.get(socket.room_id);

    // Convert API result end time from seconds + nanoseconds to milliseconds
    resultEndTime =
      data.results[0].resultEndTime.seconds * 1000 +
      Math.round(data.results[0].resultEndTime.nanos / 1000000);

    // Calculate correct time (considering restarts)
    // based on offset from audio sent twice
    const correctedTime =
      resultEndTime - bridgingOffset + streamingLimit * restartCounter;

    let transcript = "";
    if (data.results[0]?.alternatives[0]) {
      // A sentence arrived. It may be final(isFinal) or still in progress(interim).
      transcript = data.results[0].alternatives[0].transcript.trim();

      // Paragraph switch timer should be reset when someone starts talking.
      clerk.clearSwitchTimeout();
      clerk.startSwitchTimeout();
    }

    if (data.results[0]?.isFinal) {
      // Clerk accumulates these full sentences ("final" results)
      console.log(`${correctedTime}(${socket.name}): ${transcript}`);

      // When speaker changes, paragraph switches.
      if (clerk.speakerId !== socket.id) {
        clerk.switchParagraph(socket.id, socket.name, transcript);
      } else {
        clerk.appendTranscript(transcript);
      }

      isFinalEndTime = resultEndTime;
      lastTranscriptWasFinal = true;
    } else {
      lastTranscriptWasFinal = false;
    }
  };

  // Interface between input audio stream and recognition stream.
  // Acts as a buffer to smoothe out restarts of recognize stream.
  const audioInputStreamTransform = new Writable({
    write(chunk, encoding, next) {
      // Send audio input chunks if recognition stream restarts.
      if (newStream && lastAudioInput.length !== 0) {
        // Approximate duration of each chunk
        const chunkTime = streamingLimit / lastAudioInput.length;
        if (chunkTime !== 0) {
          if (bridgingOffset < 0) {
            bridgingOffset = 0;
          }
          if (bridgingOffset > finalRequestEndTime) {
            bridgingOffset = finalRequestEndTime;
          }
          const chunksFromMS = Math.floor(
            (finalRequestEndTime - bridgingOffset) / chunkTime
          );
          bridgingOffset = Math.floor(
            (lastAudioInput.length - chunksFromMS) * chunkTime
          );

          for (let i = chunksFromMS; i < lastAudioInput.length; i++) {
            recognizeStream.write(lastAudioInput[i]);
          }
        }
        newStream = false;
      }

      // Store audio input for next restart.
      audioInput.push(chunk);

      if (recognizeStream) {
        recognizeStream.write(chunk);
      }

      next();
    },

    final() {
      if (recognizeStream) {
        recognizeStream.end();
      }
    },
  });

  // Closes recognition stream.
  function stopStream() {
    if (recognizeStream) {
      recognizeStream.end();
      recognizeStream.removeAllListeners("data");
      recognizeStream = null;
    }
    console.log(`Recognition from ${socket.name} ended.`);
  }

  // Restarts recognition stream
  function restartStream() {
    stopStream();

    if (resultEndTime > 0) {
      finalRequestEndTime = isFinalEndTime;
    }
    resultEndTime = 0;

    lastAudioInput = [];
    lastAudioInput = audioInput;

    restartCounter++;
    console.log(`${streamingLimit * restartCounter}: RESTARTING REQUEST`);

    newStream = true;
    startStream();
  }

  // socket event listeners
  socket.on("startRecognition", () => {
    startStream();
  });

  socket.on("binaryAudioData", (data) => {
    audioInputStreamTransform.write(data);
  });

  socket.on("endRecognition", () => {
    stopStream();
  });

  socket.on("disconnect", () => {
    stopStream();
  });

  // Stop the recognition stream and stop restarting it on disconnection.
  socket.on("disconnect", () => {
    stopStream();
    if (restartTimeout) {
      clearTimeout(restartTimeout);
    }
    console.log(`${socket.name} leaved room ${socket.room_id}`);
  });
};
