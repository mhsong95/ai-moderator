/**
 * audioFileHandler.js
 * Defines event listeners for transcripting and summarizing user audio streams.
 * References:
 * https://docs.microsoft.com/ko-kr/azure/cognitive-services/speech-service/get-started-speech-to-text?tabs=windowsinstall&pivots=programming-language-nodejs
*/

const { Writable } = require("stream");
const { clerks } = require("./global");

const fs = require("fs");

// Microsoft Azure Speech
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { subKey, servReg } = require("./config");
const speechConfig = sdk.SpeechConfig.fromSubscription(subKey, servReg);
speechConfig.speechRecognitionLanguage = "ko-KR";

module.exports = function (io, socket) {
  // Variables for maintaining infinite stream of recognition.
  const streamingLimit = 600000; // streaming limit in ms. (~1 minutes)
  let restartTimeout = null;

  // Variables for using real-time streaming
  let restartCounter = 0;
  let audioInput = [];
  let lastAudioInput = [];
  let resultEndTime = 0;
  let isFinalEndTime = 0;
  let finalRequestEndTime = 0;
  let newStream = true;
  let bridgingOffset = 0;

  // Variables for using Microsoft Azure STT service
  let pushStream = null;
  let audioConfig = null;
  let recognizer = null;

  // TODO: maybe remove? -> summarize 시기를 ms STT에서 잡으면 timeout 필요없음.
  function setStreamTimeout() {
    //// clerks.get(socket.room_id).speakerId = null;
    // Restart stream when it is about to exceed streamingLimit.
    restartTimeout = setTimeout(() => {
      restartStreamTimer();
    }, streamingLimit);
  }

  // Closes recognition stream.
  function stopStreamTimeout() {
    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }
    //// clerks.get(socket.room_id).requestSummary();
    console.log(`Stop timer in recognition from ${socket.name}.`);
  }

  // Restarts recognition stream
  function restartStreamTimer() {
    stopStreamTimeout();

    console.log(`Recognition from ${socket.name}: RESTARTING Timer`);
    clerks.get(socket.room_id).requestSummary();
    setStreamTimeout();
  }

  //* Send audio stream into microsoft STT server
  /**
   * Callback to be called when a response (transcript) arrives from API.
   * @param {RecognitionResult} data Recognition result from recognizer.recognized function
   */
  const speechCallback = (data) => {
    let clerk = clerks.get(socket.room_id);

    //TODO: remove
    console.log("speechCallbask offset/duration")
    console.log(Math.round(data.offset / 10000)); // Offset of recognized speech in 100 nano second incements.
    console.log(Math.round(data.duration / 10000)); // Duration of recognized speech in 100 nano second incements.

    // Convert API result end time from seconds + nanoseconds to milliseconds
    resultEndTime =
      Math.round(data.offset / 10000) +
      Math.round(data.duration / 10000);

    // Calculate correct time (considering restarts)
    // based on offset from audio sent twice
    const correctedTime =
      resultEndTime - bridgingOffset + streamingLimit * restartCounter;

    let transcript = data.text;

    // Paragraph switch timer should be reset when someone starts talking.
    clerk.clearSwitchTimeout();
    clerk.startSwitchTimeout();

    // Clerk accumulates these full sentences ("final" results)
    console.log(`${correctedTime}(${socket.name}): ${transcript}`);

    // When speaker changes, paragraph switches.
    if (clerk.speakerId !== socket.id) {
      clerk.switchParagraph(socket.id, socket.name, transcript, Date.now(), false);
    } else {
      clerk.appendTranscript(transcript, false);
    }

    isFinalEndTime = resultEndTime;
  };

  function startStream() {
    // Clear current audioInput (buffered audio)
    audioInput = [];

    // Create audioConfig for get audio input for stream
    pushStream = sdk.AudioInputStream.createPushStream();
    audioConfig = sdk.AudioConfig.fromStreamInput(
      pushStream,
      sdk.AudioStreamFormat.getDefaultInputFormat()
    );

    // Define recognizer
    // Document: https://docs.microsoft.com/ko-kr/javascript/api/microsoft-cognitiveservices-speech-sdk/speechrecognizer?view=azure-node-latest#recognized
    recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // recognizer.recognizing = (s, e) => {
    //   console.log(`RECOGNIZING: Text=${e.result.text}`);
    // };

    // The event recognized signals that a final recognition result is received.
    // TODO: send proper timestamp into speechCallback
    // TODO: start timestamp = start recognition + offset
    recognizer.recognized = (s, e) => {
      if (e.result.reason === sdk.ResultReason.NoMatch) {
        const noMatchDetail = sdk.NoMatchDetails.fromResult(e.result);
        console.log(
          "(recognized)  Reason: " +
          sdk.ResultReason[e.result.reason] +
          " | NoMatchReason: " +
          sdk.NoMatchReason[noMatchDetail.reason]
        );
      } else {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          speechCallback(e.result);
        } else {
          console.log(
            "ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly."
          );
        }
      }
    };

    // Event handler for speech stopped events.
    // TODO: save timestamp
    recognizer.speechEndDetected = (s, e) => {
      console.log("\n  Speech End Detected!!");
      console.log(Date.now());
      console.log(e)
      audioInput = [];
      lastAudioInput = [];
    };

    // Event handler for speech started events.
    // TODO: save timestamp
    recognizer.speechStartDetected = (s, e) => {
      console.log("\n  Speech Start Detected!!");
      console.log(e)
    };

    // The event canceled signals that an error occurred during recognition.
    recognizer.canceled = (s, e) => {
      console.log(`CANCELED: Reason=${e.reason}`);

      if (e.reason == CancellationReason.Error) {
        console.log(`"CANCELED: ErrorCode=${e.errorCode}`);
        console.log(`"CANCELED: ErrorDetails=${e.errorDetails}`);
        console.log("CANCELED: Did you update the subscription info?");
      }
      audioInput = [];
      lastAudioInput = [];
    };

    // Event handler for session stopped events.
    recognizer.sessionStopped = (s, e) => {
      console.log("\n    Session stopped event.");
      audioInput = [];
      lastAudioInput = [];
    };

    // Starts speech recognition, until stopContinuousRecognitionAsync() is called.
    recognizer.startContinuousRecognitionAsync(
      () => {
        console.log("Recognition started");
        console.log(Date.now())
      },
      (err) => {
        console.trace("err - " + err);
        recognizer.close();
      }
    );

    // Restart stream when it is about to exceed streamingLimit.
    restartTimeout = setTimeout(() => {
      restartStream();
    }, streamingLimit);
  }

  // Closes recognition stream.
  function stopStream() {
    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }

    if (pushStream) {
      // Stops continuous speech recognition.
      recognizer.stopContinuousRecognitionAsync();
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

  /** 
   * Interface between input audio stream and recognition stream.
   * Acts as a buffer to smoothe out restarts of recognize stream.
   */
  const audioInputStreamTransform = new Writable({
    write(chunk, encoding, next) {
      // Send audio input chunks if recognition stream restarts.
      if (newStream && lastAudioInput.length !== 0) {
        console.log("RESTART HANDLING")
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
            pushStream.write(lastAudioInput[i]);
          }
        }
        newStream = false;
      }

      // Store audio input for next restart.
      audioInput.push(chunk);

      if (pushStream) {
        pushStream.write(chunk);
      }

      next();
    },

    final() {
      if (pushStream) {
        pushStream.close();
      }
    },
  });

  //* Socket event listeners
  socket.on("updateParagraph", (paragraph, timestamp, editor) => {
    clerks.get(socket.room_id).updateParagraph(paragraph, timestamp, editor);
  })

  socket.on("updateSummary", (type, content, timestamp) => {
    clerks.get(socket.room_id).updateSummary(type, content, timestamp);
  })

  // TODO: save timestamp - naver STT와 같은 timestamp 받아서 저장해야 할듯
  socket.on("startRecognition", () => {
    startStream();
    console.log(
      `Recognition starting by ${socket.name} in ${socket.room_id}`
    );
  });

  /**
   * TODO: remove timestamp parameter
   * TODO: add more comment about ms STT
   * @param data audio stream data from `media-server/speech.js` file
   * @param timestamp timestamp for specify record time and file name
   */
  socket.on("binaryAudioData", (data, timestamp) => {
    //* Send audio stream data to microsoft STT server
    audioInputStreamTransform.write(data);
  });

  /**
   * TODO: save timestamp and filename in some local dictionary
   * TODO: {(timestamp): filename, ...}
   */ 
  socket.on("streamAudioData", (data, timestamp) => {
    //* Record audio files in webm format
    let filename = "./webm/" + socket.room_id + "_" + socket.name + "_" + timestamp + ".wav";
    let filestream = fs.createWriteStream(filename, { flags: 'a' });
    filestream.write(Buffer.from(new Uint8Array(data)), (err) => {
      if (err) throw err;
      console.log(timestamp);
    })
    filestream.close();
  })

  socket.on("requestSTT", (timestamp, islast) => {
    console.log("requestSTT: " + timestamp);
    console.log(islast);
    let clerk = clerks.get(socket.room_id);
    // When speaker changes, paragraph switches.
    if (clerk.speakerId !== socket.id) {
      clerks.get(socket.room_id).requestSTT(socket.room_id, socket.id, socket.name, timestamp, true, islast);
    } else {
      clerks.get(socket.room_id).requestSTT(socket.room_id, socket.id, socket.name, timestamp, false, islast);
    }
  })

  socket.on("endRecognition", () => {
    stopStream();
  });

  // Stop the recognition stream and stop restarting it on disconnection.
  socket.on("disconnect", () => {
    stopStream();
    console.log(`${socket.name} leaved room ${socket.room_id}`);
  });
};
