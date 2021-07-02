import React from "react";
import socketIOClient from "socket.io-client";
import { ResultReason } from "microsoft-cognitiveservices-speech-sdk";
const { subKey, servReg } = require("./config");
// const https = require("https");
// const fs = require("fs");
// const path = require("path");
// var http = require('http')
// const config = require("./config");
// const Clerk = require("./Clerk");
// const { clerks } = require("./global");
// const registerSpeechHandler = require("./speechHandler");


const speechsdk = require("microsoft-cognitiveservices-speech-sdk");
// const tokenObj = await getTokenOrRefresh();

const speechConfig = speechsdk.SpeechConfig.fromSubscription(
  subKey, servReg
);
speechConfig.speechRecognitionLanguage = "ko-KR";

const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
const recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);


const ENDPOINT = "https://localhost:8000";


function App() {
  // const [response, setResponse] = useState("");

  // useEffect(() => {
  const io = socketIOClient(ENDPOINT);
  // const io = socketIOClient(8001, {
  //   cors: {
  //     origin: config.mediaServerHost,
  //   }
  // })
  // socket.on("FromAPI", data => {
  //   setResponse(data);
  // });
  function sttFromMic() {
    this.setState({
      displayText: "speak into your microphone...",
    });

    recognizer.startContinuousRecognitionAsync(
      () => {
        console.log("Recognition started");
      },
      (err) => {
        console.trace("err - " + err);
        recognizer.close();
      }
    );

    recognizer.recognized = (s, e) => {
      if (e.result.reason === speechsdk.ResultReason.NoMatch) {
        const noMatchDetail = speechsdk.NoMatchDetails.fromResult(
          e.result
        );
        console.log(
          "(recognized)  Reason: " +
          speechsdk.ResultReason[e.result.reason] +
          " | NoMatchReason: " +
          speechsdk.NoMatchReason[noMatchDetail.reason]
        );
      } else {
        console.log(
          `(recognized)  Reason: ${speechsdk.ResultReason[e.result.reason]
          } | Duration: ${e.result.duration} | Offset: ${e.result.offset
          }`
        );
        console.log(`Text: ${e.result.text}`);
        // let displayText = this.state.displayText;
        if (e.result.reason === ResultReason.RecognizedSpeech) {
          // displayText =
          //   displayText + `RECOGNIZED: Text=${e.result.text}`;
          console.log("recognized")
        } else {
          // displayText =
          //     displayText +
          //   "ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly.";
          console.log("ERROR")
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

    recognizer.sessionStopped = (s, e) => {
      console.log("\n    Session stopped event.");
    };
  }

  function stopSTT() {
    recognizer.stopContinuousRecognitionAsync();
  }

  ///////////////////
  io.on("startSTT", (socket) => {
    console.log("startSTT")
    sttFromMic()

  });

  io.on("stopSTT", (socket) => {
    console.log("stopSTT")
    stopSTT()
  })

  // io.of("/").adapter.on("delete-room", (room_id) => {
  //   if (clerks.has(room_id)) {
  //     let clerk = clerks.get(room_id);
  //     clerk.clearSwitchTimeout();
  //     clerks.delete(room_id);
  //     console.log(`Room deleted: ${room_id}`);
  //   }
  // });
  // }, []);

  // httpServer.listen(config.listenPort, () => {
  //   console.log(`moderator server listening https ${config.listenPort}`);
  // });
  ///////////////////





  return (
    <p>
      {/* It's <time dateTime={response}>{response}</time> */}
    </p>
  );
}

export default App;