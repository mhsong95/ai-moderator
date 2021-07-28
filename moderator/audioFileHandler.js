// msspeechHandler.js
// Defines event listeners for transcripting and summarizing user audio streams.
// References:
// https://docs.microsoft.com/ko-kr/azure/cognitive-services/speech-service/get-started-speech-to-text?tabs=windowsinstall&pivots=programming-language-nodejs

const { clerks } = require("./global");

const fs = require("fs");

module.exports = function (io, socket) {
  // Variables for maintaining infinite stream of recognition.
  const streamingLimit = 60000; // streaming limit in ms. (~1 minutes)
  let restartTimeout = null;

  function startStream() {
    // clerks.get(socket.room_id).speakerId = null;
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
    // clerks.get(socket.room_id).requestSummary();
    console.log(`Recognition from ${socket.name} ended.`);
  }

  // Restarts recognition stream
  function restartStream() {
    stopStream();

    console.log(`Recognition from ${socket.name}: RESTARTING REQUEST`);
    clerks.get(socket.room_id).requestSummary();
    startStream();
  }

  socket.on("updateParagraph", (paragraph, timestamp, editor) => {
    clerks.get(socket.room_id).updateParagraph(paragraph, timestamp, editor);
  })

  socket.on("updateSummary", (type, content, timestamp) => {
    clerks.get(socket.room_id).updateSummary(type, content, timestamp);
  })

  // socket event listeners
  socket.on("startRecognition", () => {
    startStream();
    console.log(
      `Recognition starting by ${socket.name} in ${socket.room_id}`
    );
  });

  socket.on("binaryAudioData", (data, timestamp) => {
    let filename = "./webm/"+socket.room_id+"_"+socket.name+"_"+timestamp+".webm";
    let filestream = fs.createWriteStream(filename, { flags: 'a' });
    filestream.write(Buffer.from(new Uint8Array(data)), (err) => {
      if (err) throw err;
      console.log(timestamp);
    })
    filestream.close();
  });

  socket.on("requestSTT", (timestamp, islast) => {
    console.log("requestSTT: "+timestamp);
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
