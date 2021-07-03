// speechHandler.js
// Defines event listeners for transcripting and summarizing user audio streams.
// References:
// https://github.com/googleapis/nodejs-speech/blob/master/samples/infiniteStreaming.js
// https://cloud.google.com/speech-to-text/docs/quickstart-client-libraries?hl=ko

const { Writable } = require("stream");
const axios = require("axios");
const { clerks } = require("./global");

// Microsoft Azure Speech
// const fs = require('fs');

const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { subKey, servReg } = require("./config");
const speechConfig = sdk.SpeechConfig.fromSubscription(subKey, servReg);
speechConfig.speechRecognitionLanguage = "ko-KR";



module.exports = function (io, socket) {
  // Variables for maintaining infinite stream of recognition.
  const streamingLimit = 290000; // streaming limit in ms. (~5 minutes)
  let restartCounter = 0;
  let audioInput = [];
  let lastAudioInput = [];
  let resultEndTime = 0;
  let isFinalEndTime = 0;
  let finalRequestEndTime = 0;
  let newStream = true;
  let bridgingOffset = 0;
  let restartTimeout = null;

  //// AZURE
  let pushStream = null;
  let audioConfig = null;
  let recognizer = null;
  let lastoffset = 0;


  // Callback to be called when a response (transcript) arrives from API.
  const speechCallback = (data) => {
    // console.log("speechCallback!!");
    let clerk = clerks.get(socket.room_id);

    // Convert API result end time from seconds + nanoseconds to milliseconds
    resultEndTime =
      Math.round(data.offset / 1000000) +
      Math.round(data.duration / 1000000);

    // Calculate correct time (considering restarts)
    // based on offset from audio sent twice
    const correctedTime =
      resultEndTime - bridgingOffset + streamingLimit * restartCounter;

    let transcript = data.text;
    // if (data.results[0]?.alternatives[0]) {
    //   // A sentence arrived. It may be final(isFinal) or still in progress(interim).
    //   transcript = data.results[0].alternatives[0].transcript.trim();

      // Paragraph switch timer should be reset when someone starts talking.
      clerk.clearSwitchTimeout();
      clerk.startSwitchTimeout();
    // }

    // if (lastoffset !== data.offset) {
      // Clerk accumulates these full sentences ("final" results)
      console.log(`${correctedTime}(${socket.name}): ${transcript}`);

      // When speaker changes, paragraph switches.
      if (clerk.speakerId !== socket.id) {
        clerk.switchParagraph(socket.id, socket.name, transcript);
      } else {
        clerk.appendTranscript(transcript);
      }

      isFinalEndTime = resultEndTime;
    //   lastoffset = data.offset;
    // }
  };

  // Interface between input audio stream and recognition stream.
  // Acts as a buffer to smoothe out restarts of recognize stream.
  const audioInputStreamTransform = new Writable({
    write(chunk, encoding, next) {
      // console.log("audioInputStreamTransform!");
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
            // console.log("audioInputStreamTransform!:::: lastinput");
            pushStream.write(lastAudioInput[i]);
          }
        }
        newStream = false;
      }

      // Store audio input for next restart.
      audioInput.push(chunk);

      if (pushStream) {
        // console.log("audioInputStreamTransform!:: normal");
        // recognizeStream.write(chunk);
        pushStream.write(chunk);
      }

      next();
    },

    final() {
      if (pushStream) {
        // recognizeStream.end();
        pushStream.close();
      }
    },
  });

  function startStream() {
    console.log(`Recognition starting by ${socket.name} in ${socket.room_id}`);

    // Clear current audioInput (buffered audio)
    audioInput = [];

    
    pushStream = sdk.AudioInputStream.createPushStream();

    audioConfig = sdk.AudioConfig.fromStreamInput(pushStream, sdk.AudioStreamFormat.getDefaultInputFormat());

    recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    

    // recognizer.recognizing = (s, e) => {
    //   // console.log(`RECOGNIZING: Text=${e.result.text}`);
    //   // // console.log(e.result.offset);
    //   // // console.log(e.result.duration);
    //   // speechCallback(e.result);
    // };

    recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.NoMatch) {
            const noMatchDetail = sdk.NoMatchDetails.fromResult(
                e.result
            );
            console.log(
                "(recognized)  Reason: " +
                    sdk.ResultReason[e.result.reason] +
                    " | NoMatchReason: " +
                    sdk.NoMatchReason[noMatchDetail.reason]
            );
        } else {
            // console.log(
            //     `(recognized)  Reason: ${
            //         sdk.ResultReason[e.result.reason]
            //     } | Duration: ${e.result.duration} | Offset: ${
            //         e.result.offset
            //     }`
            // );
            // console.log(`Text: ${e.result.text}`);
            if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
              speechCallback(e.result);
                // displayText =
                //     displayText + `RECOGNIZED: Text=${e.result.text}`;
            } else {
              console.log("ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly.");
            }
          
            // this.setState({
            //     displayText: displayText,
            // });
        }
    };

    recognizer.speechEndDetected = (s, e) => {
        console.log("\n  Speech End Detected!!");
    };

    recognizer.speechStartDetected = (s, e) => {
        console.log("\n  Speech Start Detected!!");
    };

    recognizer.canceled = (s, e) => {
        console.log(`CANCELED: Reason=${e.reason}`);

        if (e.reason == CancellationReason.Error) {
            console.log(`"CANCELED: ErrorCode=${e.errorCode}`);
            console.log(`"CANCELED: ErrorDetails=${e.errorDetails}`);
            console.log("CANCELED: Did you update the subscription info?");
        }
    };

    recognizer.sessionStopped = (s, e) => {
        console.log("\n    Session stopped event.");
    };

    recognizer.startContinuousRecognitionAsync(
            () => {
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

  // Closes recognition stream.
  function stopStream() {
    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }
    if (pushStream) {
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
    startStream()
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
    // recognizer.stopContinuousRecognitionAsync();
  });

  // Stop the recognition stream and stop restarting it on disconnection.
  socket.on("disconnect", () => {
    stopStream();
    // recognizer.stopContinuousRecognitionAsync();
    console.log(`${socket.name} leaved room ${socket.room_id}`);
  });
};
