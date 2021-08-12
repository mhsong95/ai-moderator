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
const { time } = require("console");
const speechConfig = sdk.SpeechConfig.fromSubscription(subKey, servReg);
speechConfig.speechRecognitionLanguage = "ko-KR";

module.exports = function (io, socket) {
  // Variables for using Microsoft Azure STT service
  let pushStream = null;
  let audioConfig = null;
  let recognizer = null;

  /**
   * Dictionary for logging timestamp
   * 
   * key: timestamp from "startRecognition" socket message
   * value: { "init": time when `startContinuousRecognitionAsync` function started,
   *          "startLogs": [ [start recognition timestamp, recognizied timestamps], ... ]
   *          "endLogs": end recognition timestamps }
   */
  let timestamps = {};

  // Current timestamp section for MS STT
  let curTimestamp = 0;

  // Current record timestamp
  let curRecordTimestamp = 0;
  let lastStopTimestamp = 0;

  // Mark speech already end
  let speechEnd = true;

  // Mark recognition end 
  let endRecognition = true;

  /**
   * Audio file lists from each user
   * 
   * key: timestamp from "streamAudioData" socket message
   * value: filename(string) used to access file
   */
  let audiofiles = [];

  /**
   * @param {String} type "startLogs" or "endLogs"
   * @returns Last element of corresponding type in timestamps[curTimestamp]
   */
  function getLastTimestamp(type) {
    let len = timestamps[curTimestamp][type].length
    if (len == 0) {
      return 0
    }
    return timestamps[curTimestamp][type][len - 1]
  }

  //* Send audio stream into microsoft STT server
  /**
   * Callback to be called when a response (transcript) arrives from API.
   * @param {RecognitionResult} data Recognition result from recognizer.recognized function
   */
  const speechCallback = async (data) => {
    let clerk = clerks.get(socket.room_id);

    let transcript = data.text;
    let timestamp = getLastTimestamp("startLogs");

    if (timestamp) {
      timestamps[curTimestamp]["startLogs"][timestamps[curTimestamp]["startLogs"].length - 1].push(Date.now())
      timestamp = getLastTimestamp("startLogs");
    }

    // Clerk accumulates these full sentences ("final" results)
    console.log(`${new Date(Number(timestamp[0]))}(${socket.name}): ${transcript}`);

    // Calculate current timestamp
    let { ts, isLast } = await clerk.getMsgTimestamp(socket.id, socket.name, timestamp, false);

    // Update temporary messagebox
    clerk.tempParagraph(socket.id, socket.name, transcript, ts);

    restartRecord(ts, isLast);
  };

  function restartRecord(timestamp, isLast) {
    if (endRecognition) {
      isLast = true;
      speechEnd = true;
    }

    // start new recording signal
    let startTimestamp = Date.now();
    socket.emit("startNewRecord", startTimestamp);

    // stop recording signal
    let stopTimestamp = Date.now();
    socket.emit("stopCurrentRecord");

    // send temp Naver STT request
    try {
      clerks.get(socket.room_id).requestSTT(socket.room_id, socket.id, socket.name, timestamp, curRecordTimestamp, lastStopTimestamp, isLast);
    }
    catch (e) {
      console.log("ERR: ", e)
    }

    curRecordTimestamp = startTimestamp;
    lastStopTimestamp = stopTimestamp;
  }

  /**
   * TODO: add comment
   */
  function startStream() {
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
    recognizer.speechEndDetected = async (s, e) => {
      console.log("\n  Speech End Detected!!", socket.name);
      // console.log(e)

      if (speechEnd) {
        console.log("Already processed speech!")
        return;
      }
      speechEnd = true;

      let { ts, isLast } = await clerks.get(socket.room_id).getMsgTimestamp(socket.id, socket.name, getLastTimestamp("startLogs"), true);

      restartRecord(ts, isLast);
    };

    // Event handler for speech started events.
    // DESIGN: Write speech start detected log at server
    recognizer.speechStartDetected = (s, e) => {
      if (!speechEnd) {
        console.log("\n  Speech Start Detected (Duplicate) !!\n from ", socket.name);
        return;
      }
      // Save speech start timestamp
      const startTime = Date.now();

      timestamps[curTimestamp]["startLogs"].push([startTime]);
      speechEnd = false;

      console.log("\n  Speech Start Detected!!\n from ", socket.name, "\n startTime: ", startTime);
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
    };

    // Event handler for session stopped events.
    // DESIGN: Write session stopped log at server
    recognizer.sessionStopped = (s, e) => {
      console.log("\n    Session stopped event.");
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
  }

  // Closes recognition stream.
  function stopStream() {
    if (recognizer) {
      // Stops continuous speech recognition.
      // DESIGN: Write end recognition log at server
      recognizer.stopContinuousRecognitionAsync();
    }

    // Initialize values
    pushStream = null;
    audioConfig = null;
    recognizer = null;

    console.log(`Recognition from ${socket.name} ended.`);
  }

  /** 
   * Interface between input audio stream and recognition stream.
   * Acts as a buffer to smoothe out restarts of recognize stream.
   */
  const audioInputStreamTransform = new Writable({
    write(chunk, encoding, next) {
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
    endRecognition = false;
    console.log(
      `Recognition starting by ${socket.name} in ${socket.room_id}`
    );

    // Leave timestamp log for further use
    // PIN: timestamp def
    timestamps[timestamp] = { "init": 0, "startLogs": [], "endLogs": [] }
    curTimestamp = timestamp;
    audiofiles = [];

    curRecordTimestamp = 0;
    lastStopTimestamp = 0;
    speechEnd = true;

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

      if (curRecordTimestamp == 0) {
        curRecordTimestamp = timestamp
      }

      // DESIGN: Write new file log at server
    }
  })

  /**
   * TODO: Add comment
   */
  socket.on("endRecognition", () => {
    console.log("endRecognition");
    endRecognition = true;
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
