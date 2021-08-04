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
  // ? TODO: remove streamLimit?
  const streamingLimit = 300000; // streaming limit in ms.
  let restartTimeout = null;

  // Variables for using real-time streaming
  let restartCounter = 0;
  let audioInput = [];
  let lastAudioInput = [];
  let newStream = true;

  // Variables for using Microsoft Azure STT service
  let pushStream = null;
  let audioConfig = null;
  let recognizer = null;

  /**
   * Dictionary for logging timestamp
   * 
   * key: timestamp from "startRecognition" socket message
   * value: { "init": time when `startContinuousRecognitionAsync` function started,
   *          "prevStart": previous start recognition timestamp, 
   *          "prevEnd": previous end recognition timestamp, 
   *          "curStart": current start recognition timestamp }
   */
  let timestamps = {};

  // Current timestamp section for MS STT
  let curTimestamp = 0;

  /**
   * Audio file lists from each user
   * 
   * key: timestamp from "streamAudioData" socket message
   * value: filename(string) used to access file
   */
  let audiofiles = [];

  //* Send audio stream into microsoft STT server
  /**
   * Callback to be called when a response (transcript) arrives from API.
   * @param {RecognitionResult} data Recognition result from recognizer.recognized function
   */
  const speechCallback = (data) => {
    let clerk = clerks.get(socket.room_id);
    audioInput = [];

    /**
     * Calculate correct time (considering restarts)
     * based on offset from audio sent twice
     * ? DESIGN: remove corrected time
     * Invariant: unit is milisecond
     */

    let transcript = data.text;
    let timestamp = timestamps[curTimestamp]["curStart"];

    // Clerk accumulates these full sentences ("final" results)
    console.log(`${timestamp}(${socket.name}): ${transcript}`);

    // Update temporary messagebox
    clerk.tempParagraph(socket.id, socket.name, transcript, timestamp);
  };

  /**
   * TODO: add comment
   */
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

    // The event recognized signals that a final recognition result is received.
    // DESIGN: Write recognized log at server
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
    // DESIGN: Write speech end detected log at server
    recognizer.speechEndDetected = (s, e) => {
      console.log("\n  Speech End Detected!!", socket.name);
      console.log(e)

      processAudioSTT(Date.now());
    };

    // Event handler for speech started events.
    // DESIGN: Write speech start detected log at server
    recognizer.speechStartDetected = (s, e) => {
      console.log("\n  Speech Start Detected!! ", socket.name);
      console.log("event log", e)

      // Save speech start timestamp
      const startTime = Date.now();
      console.log("start time", startTime);

      timestamps[curTimestamp]["curStart"] = startTime;
    };

    // The event canceled signals that an error occurred during recognition.
    // DESIGN: Write canceled log at server
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
    // DESIGN: Write session stopped log at server
    recognizer.sessionStopped = (s, e) => {
      console.log("\n    Session stopped event.");
      audioInput = [];
      lastAudioInput = [];
    };

    // Starts speech recognition, until stopContinuousRecognitionAsync() is called.
    // DESIGN: Write start recognition log at server
    recognizer.startContinuousRecognitionAsync(
      () => {
        timestamps[curTimestamp]["init"] = Date.now();
        console.log(timestamps[curTimestamp]["init"])
        console.log("Recognition started");
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

  function processAudioSTT(timestamp) {
    console.log("Process Audio STT: ", curTimestamp, timestamps, audiofiles);
    if (timestamps[curTimestamp]["curStart"] <= timestamps[curTimestamp]["prevEnd"]) {
      console.log("Already calculated section: ", timestamps[curTimestamp]["prevStart"]);
      return;
    }
    console.log(audiofiles);
    let whichAudio = audiofiles[audiofiles.length - 1];

    if (recognizer) { socket.emit("restartRecord"); }

    audioInput = [];
    lastAudioInput = [];

    // Update timestamp
    let prevEnd = timestamp; //curTimestamp + Math.round(privOffset / 10000);
    let prevStart = timestamps[curTimestamp]["curStart"];
    let lastEnd = timestamps[curTimestamp]["prevEnd"];
    timestamps[curTimestamp]["curStart"] = lastEnd;
    timestamps[curTimestamp]["prevEnd"] = prevEnd;
    timestamps[curTimestamp]["prevStart"] = prevStart;

    console.log("whichAudio??? ", whichAudio);
    clerks.get(socket.room_id).requestSTT(socket.room_id, socket.id, socket.name, prevStart, prevEnd, whichAudio);
  }

  // Closes recognition stream.
  function stopStream() {
    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }

    if (recognizer) {
      // Stops continuous speech recognition.
      // DESIGN: Write end recognition log at server
      recognizer.stopContinuousRecognitionAsync();
      recognizer = null;
    }
    lastAudioInput = [];
    console.log(`Recognition from ${socket.name} ended.`);
  }

  // Restarts recognition stream
  function restartStream() {
    stopStream();

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
      if (newStream && lastAudioInput.length !== 0){
        console.log("RESTART - restore lastAudioInput: ", lastAudioInput.length)
        for (let i = 0; i < lastAudioInput.length; i++) {
          pushStream.write(lastAudioInput[i]);
        }
        lastAudioInput = [];
      }
      newStream = false;

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
  /**
   * TODO: Add comment
   */
  socket.on("updateParagraph", (editTimestamp, paragraph, timestamp, editor) => {
    clerks.get(socket.room_id).updateParagraph(editTimestamp, paragraph, timestamp, editor);
  })

  /**
   * TODO: Add comment
   */
  socket.on("updateSummary", (editTimestamp, type, content, timestamp) => {
    clerks.get(socket.room_id).updateSummary(editTimestamp, type, content, timestamp);
  })

  /**
   * TODO: Add comment
   */
  socket.on("startRecognition", (timestamp) => {
    console.log(
      `Recognition starting by ${socket.name} in ${socket.room_id}`
    );

    // Leave timestamp log for further use
    timestamps[timestamp] = { "init": 0, "prevStart": 0, "prevEnd": 0, "curStart": 0 };
    curTimestamp = timestamp;

    // Start ms STT service
    startStream();
  });

  /**
   * TODO: add more comment about ms STT
   * 
   * @param data audio stream data from `media-server/speech.js` file
   * @param timestamp timestamp for specify record time and file name
   */
  socket.on("binaryAudioData", (data) => {
    //* Send audio stream data to microsoft STT server
    audioInputStreamTransform.write(data);
  });

  /**
   * Socket message from `media-server/public/js/speech.js`.
   * 
   * @param {mediaRecoder data} data Audio data from mediarecorder in user's browser
   * @param {Number} timestamp Timestamp where audio recording starts
   * 
   */
  socket.on("streamAudioData", (data, timestamp) => {
    // Record audio files in webm format
    let filename = "./webm/" + socket.room_id + "_" + socket.name + "_" + timestamp + ".webm";
    let filestream = fs.createWriteStream(filename, { flags: 'a' });
    filestream.write(Buffer.from(new Uint8Array(data)), (err) => {
      if (err) throw err;
    })
    filestream.close();

    // Update `audiofiles`
    if (!audiofiles.includes(timestamp)) {
      audiofiles.push(timestamp);

      //TODO: remove[debug]
      console.log("Save file log");
      console.log(audiofiles);

      // DESIGN: Write new file log at server
    }
  })

  /**
   * TODO: Add comment
   */
  socket.on("endRecognition", () => {
    stopStream();
  });

  /**
   * Stop the recognition stream and stop restarting it on disconnection.
   */
  socket.on("disconnect", () => {
    stopStream();
    console.log(`${socket.name} leaved room ${socket.room_id}`);
  });
};
