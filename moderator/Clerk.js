// Clerk.js
// Defines Clerk class that keeps track of last "paragraph" in each room.
// Clerk also interacts with the summary server.

const axios = require("axios");
const config = require("./config");

// Read and write logs
const fs = require("fs");
const getLastLine = require('./fileTools.js').getLastLine;
const { time } = require("console");

const summaryHost = config.summaryHost;

const summarizerPorts = config.summarizerPorts;
const sumPortCnt = summarizerPorts.length;

const sttPorts = config.sttPorts;
const sttPortCnt = sttPorts.length;

const sttNumKeys = config.numKeys;

let summarizerHosts = []
for (i = 0; i < sumPortCnt; i++) {
  summarizerHosts.push(summaryHost + summarizerPorts[i])
}

let sttHosts = []
for (i = 0; i < sttPortCnt; i++) {
  sttHosts.push(summaryHost + sttPorts[i])
}

let keyword_trends = {};

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
     * - summary result
     * - edit transcript log {timestamp: (editor, content, summary elements)}
     * - edit summary log {timestamp: (editor, content)}
     */
    this.paragraphs = {}


    /**
     * TODO: update this comment
     * summarizer 포트 지정
     */
    this.summarizerPorts = summarizerHosts;
    this.sttPorts = sttHosts;
    this.sumPortCnt = sumPortCnt;
    this.sttPortCnt = sttPortCnt;
    this.sttKeyCnt = sttNumKeys;

    this.requestSTTIdx = 0;
    this.sttKeyIdx = 0;
    this.requestSumIdx = 0;
  }

  restoreParagraphs() {
    const fileName = './logs/' + this.room_id + '.txt'

    fs.access(fileName, fs.F_OK, (err) => {
      if (err) {
        console.log("No previous conversation");

        // read Default-Conversation
        const defaultfileName = './logs/Default-Conversation.txt'
        fs.access(defaultfileName, fs.F_OK, (err) => {
          if (err) {
            console.log("No default conversation")
            return
          }

          // File exists
          const minLineLength = 1
          getLastLine(defaultfileName, minLineLength)
            .then((lastLine) => {
              let past_paragraphs = JSON.parse(lastLine);
              this.paragraphs = past_paragraphs;
              this.io.sockets
                .to(this.room_id)
                .emit("restore", this.paragraphs);
              this.addRoomLog();
            })
            .catch((err) => {
              console.error(err)
            })
        });

        return
      }

      // File exists
      const minLineLength = 1
      getLastLine(fileName, minLineLength)
        .then((lastLine) => {
          console.log(lastLine)
          console.log(JSON.parse(lastLine))
          let past_paragraphs = JSON.parse(lastLine);
          this.paragraphs = past_paragraphs;
          this.io.sockets
            .to(this.room_id)
            .emit("restore", this.paragraphs);
        })
        .catch((err) => {
          console.error(err)
        })
    })
  }

  /**
   * TODO: add comment
   * add update paragraph function: update overall paragraph data after naver STT
   * @param {*} speakerName 
   * @param {*} transcript 
   * @param {*} timestamp 
   */
  getReplaceTranscript(timestamp) {
    let naverTrans = this.paragraphs[timestamp]["naver"];
    let msTrans = this.paragraphs[timestamp]["ms"];

    if (!msTrans.length) {
      this.io.sockets
        .to(this.room_id)
        .emit("removeMsg", timestamp);
      return;
    }

    let replaceTranscript = naverTrans.join(' ');
    let appendLen = msTrans.length - naverTrans.length;

    for (let i = 0; i < appendLen; i++) {
      replaceTranscript += ' ' + msTrans[naverTrans.length + i];
    }

    return replaceTranscript
  }

  /**
   * TODO: ADD comment
   * MS STT에서 return 된 transcript를 임시로 messagebox에 표시
   * 
   * DESIGN: maybe add log?
   */
  tempParagraph(speakerId, speakerName, transcript, timestamp) {
    console.log("tempParagraph: ", timestamp, transcript);

    // Save transcript
    if (timestamp in this.paragraphs) {
      console.log("add transcript to existing msgbox")
      this.paragraphs[timestamp]["ms"].push(transcript);
      console.log(timestamp, this.paragraphs[timestamp]);
    }
    else {
      console.log("add new msgbox")
      this.paragraphs[timestamp] = {
        "speakerID": speakerId,
        "speakerName": speakerName,
        "ms": [transcript],
        "naver": [],
        "sum": {},
        "editTrans": {},
        "editSum": {},
        "pinned": false,
      }
    }

    let replaceTranscript = this.getReplaceTranscript(timestamp);

    // Show message box
    this.publishTranscript(replaceTranscript, speakerName, timestamp);
  }

  replaceParagraph(speakerName, timestamp) {
    console.log("replaceParagraph: ", speakerName, timestamp);

    let replaceTranscript = this.getReplaceTranscript(timestamp);
    // Show message box
    this.publishTranscript(replaceTranscript, speakerName, timestamp);
  }

  /**
   * TODO: leave comment
   */
  removeMsg(timestamp) {
    this.io.sockets
      .to(this.room_id)
      .emit("removeMsg", timestamp);
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
   * Broadcasts a transcript to the room.
   */
  publishTranscript(transcript, name, timestamp) {
    this.addRoomLog();
    this.io.sockets
      .to(this.room_id)
      .emit("transcript", transcript, name, timestamp);
  }

  /**
   * Requests for a summary for the current paragraph, then
   * broadcasts the result with given confidence level.
   */
  requestSummary(speakerId, speakerName, paragraph, timestamp) {
    console.log("requestSummary");
    if (!paragraph) {
      paragraph = this.paragraphs[speechStart]["naver"].join(' ')
    }

    let idx = this.requestSumIdx;
    this.requestSumIdx = ++this.requestSumIdx % this.sumPortCnt;
    let host = this.summarizerPorts[idx];

    console.log("HOST: ", host)
    console.log("this.requestSumIdx: ", this.requestSumIdx)

    if (paragraph.split(' ')[0].length == 0) return;

    axios
      .post(
        host,
        {
          type: "requestSummary",
          user: speakerId,
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

          // summaryArr: [Abstractive, Extractive, Keywords]
          summaryArr = summary_text.split("@@@@@AB@@@@@EX@@@@@");

          // Calculate trending keywords
          let top10_trending = [];
          var trending_sort = [];
          let new_keywords = summaryArr[2].split('@@@@@CD@@@@@AX@@@@@');
          for (var key in keyword_trends) {
            keyword_trends[key] *= 0.8;
          }
          let i = 5;
          for (key of new_keywords) {
            if (key in keyword_trends) {
              keyword_trends[key] += i;
            }
            else {
              keyword_trends[key] = i;
            }
            i--;
          }
          for (var key in keyword_trends) {
            trending_sort.push([key, keyword_trends[key]]);
          }
          trending_sort.sort(function (a, b) {
            return b[1] - a[1];
          });
          for (key of trending_sort.slice(0, 5)) {
            if (key[1] > 3) {
              top10_trending.push(key[0]);
            }
          }
          // summaryArr[3]: Trending keywords
          summaryArr.push(top10_trending.join('@@@@@CD@@@@@AX@@@@@'));
        }

        // Update room conversation log
        this.paragraphs[timestamp]["sum"] = { summaryArr: summaryArr, confArr: confArr }
        this.addRoomLog();

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

  updateParagraph(editTimestamp, paragraph, timestamp, editor) {
    let idx = this.requestSumIdx;
    this.requestSumIdx = ++this.requestSumIdx % this.sumPortCnt;
    let host = this.summarizerPorts[idx];

    console.log("HOST: ", host)
    console.log("this.requestSumIdx: ", this.requestSumIdx)

    axios
      .post(
        host,
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

        // Update room conversation log: content and summary
        let checkTimeStamp = timestamp.split('@@@');
        if (checkTimeStamp[0] !== "summary-for-keyword") {
          this.paragraphs[timestamp]["editTrans"][editTimestamp] = { editor: editor, content: paragraph, sum: [summaryArr, confArr] };
          this.addRoomLog();
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

  updateSummary(editTimestamp, type, content, timestamp) {
    if (type == "absum") {
      this.paragraphs[timestamp]["editSum"][editTimestamp] = { content: content };
      this.addRoomLog();
    }
    else if (type == "pin") {
      if (this.paragraphs[timestamp]["pinned"]) {
        this.paragraphs[timestamp]["pinned"] = false;
      }
      else {
        this.paragraphs[timestamp]["pinned"] = true;
      }
    }
    this.io.sockets
      .to(this.room_id)
      .emit("updateSummary", type, content, timestamp);
  }

  /**
   * TODO: add comment
   * request temp stt
   */
  // TODO: remove userID if it is not used in `summarizer/server.py`
  requestSTT(roomID, userId, user, speechStart, trimStart, trimEnd, isLast) {
    let idx = this.requestSTTIdx;
    this.requestSTTIdx = ++this.requestSTTIdx % this.sttPortCnt;
    let host = this.sttPorts[idx];

    let keyIdx = this.sttKeyIdx;
    this.sttKeyIdx = ++this.sttKeyIdx % this.sttKeyCnt;

    console.log("-----requestSTT-----")
    console.log("HOST: ", host)
    console.log("this.requestSTTIdx: ", this.requestSTTIdx)
    console.log("speechStart timestamp: ", new Date(Number(speechStart)))
    console.log("-----request Start-----");

    axios
      .post(
        host,
        {
          type: "requestSTT",
          roomID,
          user,
          startTimestamp: trimStart,
          endTimestamp: trimEnd,
          keyIdx
        },
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      )
      .then((response) => {
        console.log("request success");
        let transcript;
        if (response.status === 200) {
          transcript = response.data;
        }

        // DESIGN: UPDATE naver STT log
        if (transcript) {
          this.paragraphs[speechStart]["naver"].push(transcript);
          console.log("(Clerk.js - requestSTT) transcript: ", transcript);
        } else {
          let invalidSTT = this.paragraphs[speechStart]["ms"].splice(this.paragraphs[speechStart]["naver"].length, 1);
          console.log("(Clerk.js - requestSTT) Remove invalidSTT: ", invalidSTT);
        }
        console.log("Update naver STT log: ", this.paragraphs[speechStart]["naver"].join(' '))

        // Update message box transcript
        this.replaceParagraph(user, speechStart);

        if (isLast) {
          // Conduct summarizer request
          this.requestSummary(userId, user, this.paragraphs[speechStart]["naver"].join(' '), speechStart);
        }
      })
      .catch((e) => {
        console.log("CATCH - requestSTT");
        console.log(e);
      });
  }

  /**
   * TODO: add comment
   */
  addRoomLog() {
    // Construct new log file for room
    fs.appendFile('./logs/' + this.room_id + '.txt', JSON.stringify(this.paragraphs) + '\n', function (err) {
      if (err) throw err;
      console.log('Log is added successfully.');
    });
  }
};
