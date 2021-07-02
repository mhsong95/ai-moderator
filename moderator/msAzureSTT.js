// speechHandler.js
// Defines event listeners for transcripting and summarizing user audio streams.
// References:
// https://github.com/googleapis/nodejs-speech/blob/master/samples/infiniteStreaming.js
// https://cloud.google.com/speech-to-text/docs/quickstart-client-libraries?hl=ko

const { Writable } = require("stream");
const axios = require("axios");
const { clerks } = require("./global");

const { subKey, servReg } = require("./config");
const SpeechSDK = require("microsoft-cognitiveservices-speech-sdk");

module.exports = function (io, socket) {
    var speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subKey, servReg);
    speechConfig.speechRecognitionLanguage = "ko-KR";

    var audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

    var recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    // Variables for maintaining infinite stream of recognition.
    // const streamingLimit = 290000; // streaming limit in ms. (~5 minutes)
    // let recognizeStream = null;
    // let restartCounter = 0;
    // let audioInput = [];
    // let lastAudioInput = [];
    // let resultEndTime = 0;
    // let isFinalEndTime = 0;
    // let finalRequestEndTime = 0;
    // let newStream = true;
    // let bridgingOffset = 0;
    // let lastTranscriptWasFinal = false;
    // let restartTimeout = null;

    recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
            const noMatchDetail = SpeechSDK.NoMatchDetails.fromResult(e.result);
            console.log(
                "(recognized)  Reason: " +
                    SpeechSDK.ResultReason[e.result.reason] +
                    " | NoMatchReason: " +
                    SpeechSDK.NoMatchReason[noMatchDetail.reason]
            );
        } else {
            console.log(
                `(recognized)  Reason: ${
                    SpeechSDK.ResultReason[e.result.reason]
                } | Duration: ${e.result.duration} | Offset: ${e.result.offset}`
            );
            console.log(`Text: ${e.result.text}`);
        }
    };

    recognizer.canceled = (s, e) => {
        let str = "(cancel) Reason: " + SpeechSDK.CancellationReason[e.reason];
        if (e.reason === SpeechSDK.CancellationReason.Error) {
            str += ": " + e.errorDetails;
        }
        console.log(str);
    };

    recognizer.speechEndDetected = (s, e) => {
        console.log(`(speechEndDetected) SessionId: ${e.sessionId}`);
        recognizer.close();
        recognizer = undefined;
    };

    // Starts a new speech recognition stream
    function startStream() {
        console.log(
            `Recognition starting by ${socket.name} in ${socket.room_id}`
        );

        recognizer.startContinuousRecognitionAsync(
            () => {
                console.log("Recognition started");
            },
            (err) => {
                console.trace("err - " + err);
                recognizer.close();
                recognizer = undefined;
            }
        );

        // // Restart stream when it is about to exceed streamingLimit.
        // restartTimeout = setTimeout(() => {
        //     restartStream();
        // }, streamingLimit);
    }

    // Closes recognition stream.
    function stopStream() {
        recognizer.stopContinuousRecognitionAsync(
            () => {
                console.log(`Recognition from ${socket.name} ended.`);
            },
            (err) => {
                console.trace("err - " + err);
                recognizer.close();
                recognizer = undefined;
            }
        );
    }

    // socket event listeners
    socket.on("startRecognition", () => {
        startStream();
    });

    // socket.on("binaryAudioData", (data) => {
    //     audioInputStreamTransform.write(data);
    // });

    socket.on("endRecognition", () => {
        stopStream();
    });

    // Stop the recognition stream and stop restarting it on disconnection.
    socket.on("disconnect", () => {
        stopStream();
        console.log(`${socket.name} leaved room ${socket.room_id}`);
    });
};
