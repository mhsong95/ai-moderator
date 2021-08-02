// Clerk.js
// Defines Clerk class that keeps track of last "paragraph" in each room.
// Clerk also interacts with the summary server.

const axios = require("axios");
const { ConsoleLoggingListener } = require("microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common.browser/Exports");
const config = require("./config");

// Maximum length of silence not to switch a paragraph.
const SILENCE_LIMIT = 10 * 1000;

module.exports = class Clerk {
  constructor (io, room_id) {
    this.io = io;
    this.room_id = room_id;

    this.paragraph = "";
    this.speakerId = null;
    this.speakerName = null;
    this.switchTimeout = null;

    // Timestamp records when a new paragraph started.
    // It can be used to identify a paragraph uniquely.
    this.timestamp = null;

    /**
     * TODO: update this comment
     * timestamp
     * - ms paragraph
     * - naver paragraph
     */
    this.paragraphs = {}
  }

  /**
   * Possibly clears switchTimeout if one exists.
   */
  // clearSwitchTimeout() {
  //   if (this.switchTimeout !== null) {
  //     clearTimeout(this.switchTimeout);
  //     this.switchTimeout = null;
  //   }
  // }

  /**
   * Sets a timer that cuts the paragraph on timeout,
   * and send request for a summary for that paragraph.
   */
  // startSwitchTimeout() {
  //   this.clearSwitchTimeout();
  //   this.switchTimeout = setTimeout(() => {
  //     if (this.speakerId !== null) {
  //       this.requestSummary();
  //     }
  //     this.speakerId = null;
  //     this.speakerName = null;
  //     this.paragraph = "";
  //     this.switchTimeout = null;
  //   }, SILENCE_LIMIT);
  // }


  /**
   * TODO: add comment
   * add update paragraph function: update overall paragraph data after naver STT
   * @param {*} speakerName 
   * @param {*} transcript 
   * @param {*} timestamp 
   */
  replaceParagraph(speakerName, transcript, timestamp) {
    this.paragraphs[timestamp]["naver"] = transcript;

    this.io.sockets
      .to(this.room_id)
      .emit("transcript", transcript, speakerName, timestamp);
  }

  /**
   * Cuts the paragraph and request summary, then switch to a new paragraph.
   */
  // TODO: remove islast
  // ? remove?
  switchParagraph(nextSpeakerId, nextSpeakerName, nextTranscript, nextTimeStamp, isLast) {
    // There might not be a paragraph, thus should check this condition.
    if (this.speakerId !== null) {
      this.requestSummary();
    }
    this.speakerId = nextSpeakerId;
    this.speakerName = nextSpeakerName;
    this.paragraph = nextTranscript;
    this.timestamp = nextTimeStamp;

    this.publishTranscript(nextTranscript, this.speakerName, this.timestamp);
    if (isLast) {
      this.requestSummary();
    }
  }

  /**
   * Appends a transcript to the paragraph.
   */
  // ? TODO: remove?
  appendTranscript(transcript, isLast) {
    this.paragraph += " " + transcript;
    this.publishTranscript(this.paragraph, this.speakerName, this.timestamp);
    if (isLast) {
      this.requestSummary();
    }
  }

  /**
   * TODO: ADD comment
   * MS STT에서 return 된 transcript를 임시로 messagebox에 표시
   * 
   * DESIGN: maybe add log?
   */
  tempParagraph(speakerId, speakerName, transcript, timestamp) {
    console.log("tempParagraph");

    // Save transcript
    if (timestamp in this.paragraphs) {
      console.log("add transcript to existing msgbox")
      this.paragraphs[timestamp]["ms"] = this.paragraphs[timestamp]["ms"] + " " + transcript;
      console.log(this.paragraphs)
    }
    else {
      console.log("add new msgbox")
      this.paragraphs[timestamp] = {
        "speakerID": speakerId,
        "speakerName": speakerName,
        "ms": transcript,
        "naver": ""
      }
    }

    // Show message box
    this.publishTranscript(this.paragraphs[timestamp]["ms"], speakerName, timestamp);
  }

  /**
   * Broadcasts a transcript to the room.
   */
  publishTranscript(transcript, name, timestamp) {
    // console.log("publishTranscript")
    if (transcript.split(' ')[0].length == 0) return;
    this.io.sockets
      .to(this.room_id)
      .emit("transcript", transcript, name, timestamp);
  }

  /**
   * Requests for a summary for the current paragraph, then
   * broadcasts the result with given confidence level.
   */
  requestSummary(speakerName, paragraph, timestamp) {
    console.log("requestSummary");
    // let paragraph = this.paragraph;
    // let speakerId = this.speakerId;
    // let speakerName = this.speakerName;
    // let timestamp = this.timestamp;
    // this.speakerId = null;
    // this.speakerName = null;
    // this.paragraph = "";
    // this.switchTimeout = null;

    if (paragraph.split(' ')[0].length == 0) return;

    axios
      .post(
        // TODO: include in config.js
        config.summaryHost,
        {
          type: "requestSummary",
          user: speakerName,
          content: paragraph,
        },
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      )
      .then((response) => {
        console.log("request Summary Success!")
        let summary, summaryArr;
        if (response.status === 200) {
          summary = response.data;
        }

        // TODO: Get the real confidence value.
        let confArr = [1, 1]; //Math.random();
        // No summary: just emit the paragraph with an indication that
        // it is not a summary (confidence === -1).
        if (!summary) {
          summaryArr = [paragraph, paragraph, "", ""];
          confArr = [0, 0];
        }
        else {
          console.log("SUMMARY::::::");
          console.log(summary);

          // Parse returned summary
          let summary_text = summary.split("@@@@@CF@@@@@")[0];
          const confidence_score = parseFloat(summary.split("@@@@@CF@@@@@")[1]);
          confArr[0] = confidence_score;

          // summaryArr: [Abstractive, Extractive, Keywords, Trending Keywords]
          summaryArr = summary_text.split("@@@@@AB@@@@@EX@@@@@");
        }

        this.io.sockets
          .to(this.room_id)
          .emit("summary", summaryArr, confArr, speakerName, timestamp);
      })
      .catch((e) => {
        console.log("request Summary Fail!")
        let summaryArr = [paragraph, paragraph, "", ""];
        let confArr = [0, 0];

        this.io.sockets
          .to(this.room_id)
          .emit("summary", summaryArr, confArr, speakerName, timestamp);
      });
  }

  updateParagraph(paragraph, timestamp, editor) {
    axios
      .post(
        // TODO: include in config.js
        config.summaryHost,
        {
          type: "requestSummary",
          user: editor,
          content: paragraph,
        },
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      )
      .then((response) => {
        let summary, summaryArr;
        if (response.status === 200) {
          summary = response.data;
        }

        // TODO: Get the real confidence value.
        let confArr = [1, 1]; //Math.random();
        // No summary: just emit the paragraph with an indication that
        // it is not a summary (confidence === -1).
        if (!summary) {
          summaryArr = [paragraph, paragraph, "", ""];
          confArr = [0, 0];
        }
        else {
          console.log("SUMMARY::::::")
          console.log(summary);

          // Parse returned summary
          let summary_text = summary.split("@@@@@CF@@@@@")[0];
          const confidence_score = parseFloat(summary.split("@@@@@CF@@@@@")[1]);
          confArr[0] = confidence_score;

          // summaryArr: [Abstractive, Extractive, Keywords, Trending Keywords]
          summaryArr = summary_text.split("@@@@@AB@@@@@EX@@@@@");
        }

        this.io.sockets
          .to(this.room_id)
          .emit("updateParagraph", paragraph, summaryArr, confArr, timestamp);
      })
      .catch((e) => {
        console.log("CATCH - updateParagraph");
        console.log(e);

        let summaryArr = [paragraph, paragraph, "", ""];
        let confArr = [0, 0];

        this.io.sockets
          .to(this.room_id)
          .emit("updateParagraph", paragraph, summaryArr, confArr, timestamp);
      });

  }

  updateSummary(type, content, timestamp) {
    this.io.sockets
      .to(this.room_id)
      .emit("updateSummary", type, content, timestamp);
  }

  /**
   * TODO: add comment
  //  * @param {*} roomID 
  //  * @param {*} userID 
  //  * @param {*} user 
  //  * @param {*} timestamp 
  //  * @param {*} isNew 
  //  * @param {*} isLast 
   */
  // TODO: remove userID if it is not used in `summarizer/server.py`
  requestSTT(roomID, user, startTimestamp, endTimestamp, audioFileList) {
    axios
      .post(
        // TODO: include in config.js
        config.summaryHost,
        {
          type: "requestSTT",
          roomID,
          user,
          startTimestamp,
          endTimestamp,
          audioFileList
        },
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      )
      .then((response) => {
        console.log("requset success");
        let transcript;
        if (response.status === 200) {
          transcript = response.data;
        }

        // Update message box transcript
        this.replaceParagraph(user, transcript, startTimestamp);

        // Conduct summarizer request
        this.requestSummary(user, transcript, startTimestamp);

        // // new speaker :: new to switch to a new paragraph
        // if (isNew) {
        //   this.switchParagraph(userID, user, transcript, timestamp, isLast);
        // }
        // else {
        //   this.appendTranscript(transcript, isLast);
        // }
      })
      .catch((e) => {
        console.log("CATCH - requestSTT");
        console.log(e);
      });
  }
};
