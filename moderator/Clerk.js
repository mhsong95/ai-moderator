// Clerk.js
// Defines Clerk class that keeps track of last "paragraph" in each room.
// Clerk also interacts with the summary server.

const axios = require("axios");

// Maximum length of silence not to switch a paragraph.
const SILENCE_LIMIT = 10 * 1000;

module.exports = class Clerk {
  constructor(io, room_id) {
    this.io = io;
    this.room_id = room_id;

    this.paragraph = "";
    this.speakerId = null;
    this.speakerName = null;
    this.switchTimeout = null;

    // Timestamp records when a new paragraph started.
    // It can be used to identify a paragraph uniquely.
    this.timestamp = null;
  }

  /**
   * Possibly clears switchTimeout if one exists.
   */
  clearSwitchTimeout() {
    if (this.switchTimeout !== null) {
      clearTimeout(this.switchTimeout);
      this.switchTimeout = null;
    }
  }

  /**
   * Sets a timer that cuts the paragraph on timeout,
   * and send request for a summary for that paragraph.
   */
  startSwitchTimeout() {
    this.clearSwitchTimeout();
    this.switchTimeout = setTimeout(() => {
      if (this.speakerId !== null) {
        this.requestSummary();
      }
      this.speakerId = null;
      this.speakerName = null;
      this.paragraph = "";
      this.switchTimeout = null;
    }, SILENCE_LIMIT);
  }

  /**
   * Cuts the paragraph and request summary, then switch to a new paragraph.
   */
  switchParagraph(nextSpeakerId, nextSpeakerName, nextTranscript) {
    // There might not be a paragraph, thus should check this condition.
    if (this.speakerId !== null) {
      this.requestSummary();
    }
    this.speakerId = nextSpeakerId;
    this.speakerName = nextSpeakerName;
    this.paragraph = nextTranscript;
    this.timestamp = Date.now();

    this.publishTranscript(nextTranscript, this.speakerName, this.timestamp);
  }

  /**
   * Appends a transcript to the paragraph.
   */
  appendTranscript(transcript) {
    this.paragraph += " " + transcript;
    this.publishTranscript(transcript, this.speakerName, this.timestamp);
  }

  /**
   * Broadcasts a transcript to the room.
   */
  publishTranscript(transcript, name, timestamp) {
    this.io.sockets
      .to(this.room_id)
      .emit("transcript", transcript, name, timestamp);
  }

  /**
   * Requests for a summary for the current paragraph, then
   * broadcasts the result with given confidence level.
   */
  requestSummary() {
    let paragraph = this.paragraph;
    let speakerId = this.speakerId;
    let speakerName = this.speakerName;
    let timestamp = this.timestamp;

    axios
      .post(
        // TODO: include in config.js
        "http://143.248.138.31:5050",
        `userId=${speakerId}&content=${paragraph}`
      )
      .then((response) => {
        let summary;
        if (response.status === 200) {
          summary = response.data;
        }

        // TODO: Get the real confidence value.
        let confidence = Math.random();
        // No summary: just emit the paragraph with an indication that
        // it is not a summary (confidence === -1).
        if (!summary) {
          summary = paragraph;
          confidence = -1;
        }

        console.log(summary);
        this.io.sockets
          .to(this.room_id)
          .emit("summary", summary, confidence, speakerName, timestamp);
      })
      .catch((e) => {
        let summary = paragraph;
        let confidence = -1;

        this.io.sockets
          .to(this.room_id)
          .emit("summary", summary, confidence, speakerName, timestamp);
      });
  }
};
