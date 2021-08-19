// transcript.js
// Defines event handlers for transcripts from moderator server.
// Includes UI control on transcription and summary data arrival.

const messages = document.getElementById("messages");
const keywordsList = document.getElementById("keywords-list");
const trending_1 = document.getElementById("trending-1");
const trending_2 = document.getElementById("trending-2");
const trending_3 = document.getElementById("trending-3");
const trending_4 = document.getElementById("trending-4");
const trending_5 = document.getElementById("trending-5");
const trending_6 = document.getElementById("trending-6");
const trending_7 = document.getElementById("trending-7");
const trending_8 = document.getElementById("trending-8");
const trending_9 = document.getElementById("trending-9");
const trending_10 = document.getElementById("trending-10");

const UnsureMessage_color = "rgba(117, 117, 117, 0.3)"
const SureMessage_Mycolor = "rgba(40, 70, 167, 0.219)"
const SureMessage_Othercolor = "rgba(40, 167, 70, 0.219)"

moderatorSocket.on("startTimer", onStartTimer);

moderatorSocket.on("restore", onRestore);
moderatorSocket.on("transcript", onTranscript);
moderatorSocket.on("removeMsg", onRemoveMsg);
// moderatorSocket.on("replaceTranscript", onReplaceTranscript);
moderatorSocket.on("summary", onSummary);

moderatorSocket.on("updateParagraph", onUpdateParagraph);
moderatorSocket.on("updateSummary", onUpdateSummary);

var notiAudio = new Audio('../img/notification.mp3');
var keywordMap = {};
var keywordParagraph = "";
var favoriteKeywords = [];
let scrollPos = 0;
var isScrolling;
var subtaskPopup;
var mapPopup;
var subtaskTryCnt = 1;
let tempAnswers = [];

var startTime = new Date();
const countDownTimer = function (id, date, word) {
  var _vDate = new Date(date); // 전달 받은 일자 
  var _second = 1000;
  var _minute = _second * 60;
  var _hour = _minute * 60;
  var _day = _hour * 24;
  var timer;

  function showRemaining() {
    var now = new Date();
    var distDt = _vDate - now;
    if (distDt < 0) {
      clearInterval(timer);
      // document.getElementById(id).textContent = '해당 이벤트가 종료 되었습니다!'; 
      document.getElementById(id).textContent = word;
      document.getElementById('subtask').setAttribute("disabled", "disabled");
      return;
    }

    var minutes = Math.floor((distDt % _hour) / _minute);
    var seconds = Math.floor((distDt % _minute) / _second);

    if (id == "meeting-timer") {
      document.getElementById(id).textContent = word + " (" + minutes + '분 ' + seconds + '초)';

      if (distDt < 5 * 60 * 1000) {
        document.getElementById(id).style.color = 'red'
      } else if (distDt < 10 * 60 * 1000) {
        document.getElementById(id).style.color = 'blue'
      }
    } else {
      if (distDt < 2 * 60 * 1000) {
        document.getElementById(id).textContent = word + " (" + minutes + '분 ' + seconds + '초)';
        document.getElementById(id).removeAttribute("disabled");
      }
    }

  }
  timer = setInterval(showRemaining, 1000);
}


function onStartTimer(startTime) {

  startTime = new Date(startTime);
  let usernumber = parseInt(user_name.slice(user_name.length - 1, user_name.length));
  console.log("onStartTimer()", startTime, "USER-NUMBER", usernumber);

  if (!isNaN(usernumber)) { // PARTICIPANTS, NOT ADMIN

    let startsubtask;
    if (usernumber <= 2) { startsubtask = usernumber; }
    else if (usernumber <= 4) { startsubtask = 3; }
    else if (usernumber <= 6) { startsubtask = 4; }
    console.log("PARTICIPANTS", user_name, "SUB-TASK START AT", startsubtask);
    countDownTimer("subtask", startTime.getTime() + (2 * startsubtask + 2) * 60 * 1000, "설문 풀기");
  }

  countDownTimer("meeting-timer", startTime.getTime() + 20 * 60 * 1000, "남은 회의 시간");
}

// Open popup for map
function openMap() {
  rc.addUserLog(Date.now(), "OPEN-MAP\n");
  mapPopup = window.open("../map.html", "_blank", "toolbar=yes,scrollbars=yes,resizable=yes,top=100,left=100,width=1200,height=900");
  mapPopup.onbeforeunload = function () {
    overlay_off();
  };
}

// Unmute when closing subtask popup
function unmuteOnClose() {
  if (['3', '5'].includes(user_name.slice(user_name.length - 1, user_name.length))) {
    let muteBtns = document.getElementsByClassName("control-overlay");
    let startAudioBtn = document.getElementById("start-audio-button");
    for (var btn of muteBtns) {
      if (btn.getAttribute("muted") === "muted") {
        btn.click();
      }
    }
  }
}

// Open popup for subtask
function openSubtask() {
  // If user_name ends with [3, 5], then use the mute function
  if (['3', '5'].includes(user_name.slice(user_name.length - 1, user_name.length))) {
    let muteBtns = document.getElementsByClassName("control-overlay");
    for (var btn of muteBtns) {
      if (btn.getAttribute("muted") === "unmuted") {
        btn.click();
      }
    }
    let stopAudioBtn = document.getElementById("stop-audio-button");
    if (!(stopAudioBtn.disabled)) {
      stopAudioBtn.click();
    }
  }
  rc.addUserLog(Date.now(), "OPEN-SUBTASK\n");
  subtaskPopup = window.open("../subtask.html", "_blank", "toolbar=yes,scrollbars=yes,resizable=yes,top=100,left=100,width=1200,height=1000");
  subtaskPopup.onbeforeunload = function () {
    overlay_off();
    unmuteOnClose();
  };
}

function overlay_on() {
  document.getElementById("overlay").style.display = "block";
  document.getElementById("left-navbar").style.transform = "translateY(100%)";
}

function overlay_off() {
  document.getElementById("overlay").style.display = "none";
  document.getElementById("left-navbar").style.transform = "translateY(0)";
}

// Submit answers for subtask
function onSubmitAnswer(answers) {
  rc.addUserLog(Date.now(), "SUBTASK-ANSWER/TRY-CNT=" + subtaskTryCnt + "/MSG=" + answers + "\n");
  console.log('SUBTASK ANSWER_TRY' + subtaskTryCnt + '=' + answers);
  subtaskTryCnt++;
  tempAnswers = [];
}

// Save answers temporarily
function onSaveAnswer(answers) {
  rc.addUserLog(Date.now(), "SAVE-TEMP-ANSWERS\n");
  console.log("SAVE TEMP ANSWERS");
  tempAnswers = answers;
}

// Logging Window Focus ON/OFF
window.addEventListener('blur', function () {
  console.log("WINDOW FOCUS OFF - timestamp=" + Date.now());
  rc.addUserLog(Date.now(), "WINDOW-FOCUS-OFF\n");
});

window.addEventListener('focus', function () {
  console.log("WINDOW FOCUS ON - timestamp=" + Date.now());
  rc.addUserLog(Date.now(), "WINDOW-FOCUS-ON\n");
});

// Logging Scroll Event
// messages.scrollTop
messages.addEventListener('scroll', function (event) {
  window.clearTimeout(isScrolling); // Clear our timeout throughout the scroll
  isScrolling = setTimeout(function () { // Set a timeout to run after scrolling ends
    if (messages.scrollTop > scrollPos) {
      console.log("SCROLL-DOWN");
      rc.addUserLog(Date.now(), "SCROLL-DOWN\n");
    }
    else {
      console.log("SCROLL-UP");
      rc.addUserLog(Date.now(), "SCROLL-UP\n");
    }
    scrollPos = messages.scrollTop;
  }, 66);
}, false);

function onUpdateParagraph(newParagraph, summaryArr, confArr, timestamp) {
  // For summary request on overall summary of favorite keywords

  let check = timestamp.toString().split('@@@');
  if (check[0] === "summary-for-keyword") {
    if (check[1] === user_name) {
      rc.addUserLog(Date.now(), 'SUMMARY-FOR-KEYWORD\n');
      let summaryBox = document.getElementById("summary-for-keyword");
      let extSumm = summaryArr[1].replace('?', '.').replace('!', '.').split('. ');
      let summaryText = summaryBox.childNodes[1].childNodes[0];

      extSummary = "";
      summaryText.textContent = "";
      for (var sentence of extSumm) {
        extSummary += "* \"" + sentence + "\"\n";
      }
      summaryBox.childNodes[1].childNodes[0].textContent = extSummary;
    }
    return;
  }

  let messageBox = document.getElementById(timestamp.toString());
  let paragraph = messageBox.childNodes[3].childNodes[1];
  let abSummaryEl = messageBox.childNodes[1];
  let speaker = messageBox.childNodes[0].childNodes[0].childNodes[0].textContent; //messageBox.title.nametag.strong.textContent  

  rc.addUserLog(Date.now(), 'UPDATE-PARAGRAPH-MESSAGEBOX/TIMESTAMP=' + timestamp +
    '/NEW-PARAGRAPH=' + newParagraph + "/OLD-PARAGRAPH=" + paragraph.textContent +
    "/NEW-SUMMARY=" + summaryArr[0] + "/OLD-SUMMARY=" + abSummaryEl.childNodes[1].textContent +
    '\n');

  paragraph.textContent = newParagraph;

  // If confidence === -1, the summary result is only the paragraph itself.
  // Do not put confidence element as a sign of "this is not a summary"
  let confidenceElem = null;
  if (confArr[0] !== -1) {
    confidenceElem = confidenceElement(confArr[0]);
    if (confArr[0] < 0.66) {
      messageBox.style.background = UnsureMessage_color;
    }
    else if (confArr[0] < 1) {
      if (user_name === speaker) { messageBox.style.background = SureMessage_Mycolor; }
      else { messageBox.style.background = SureMessage_Othercolor; }
    }
  }

  // ADD summary text and confidence score to summary-box
  abSummaryEl.childNodes[0].textContent = "[요약]"
  abSummaryEl.childNodes[0].append(confidenceElem);
  abSummaryEl.childNodes[1].textContent = summaryArr[0];

  if (messageBox.getAttribute("pinned") === "true") {
    let pinbox = document.getElementById("pin" + timestamp.toString());
    pinbox.childNodes[1].textContent = content;
  }

  // Update keyword
  let keywordBox = messageBox.childNodes[2];
  let keyList = keywordBox.childNodes;
  for (var key of keyList) {
    if (key.textContent.charAt(0) === "#") {
      key.style.display = "none";
    }
  }
  let keywordList = summaryArr[2].split("@@@@@CD@@@@@AX@@@@@");
  keywordList = keywordList.filter(item => item);
  keywordMap[timestamp.toString()] = keywordList;

  for (var keyword of keywordList) {
    addKeywordBlockHelper(timestamp, keyword);
  }

  addEditBtn(paragraph, "paragraph", timestamp);
  addEditBtn(abSummaryEl.childNodes[1], "absum", timestamp);
}

function addEditBtn(area, type, timestamp) {
  let editBtn1 = document.createElement("span");
  editBtn1.className = "edit-btn";
  editBtn1.id = "edit-" + type + "-" + timestamp;
  editBtn1.onclick = function () { editContent(type, timestamp); rc.addUserLog(Date.now(), 'START-EDIT-MESSAGE/TYPE=' + type + '/TIMESTAMP=' + timestamp + '\n'); };
  let pen1 = document.createElement("i");
  pen1.className = "fas fa-pen";
  editBtn1.append(pen1);
  area.append(editBtn1);
}

function onRestore(past_paragraphs) {
  console.log("onRestore");
  console.log(past_paragraphs);
  for (var timestamp in past_paragraphs) {
    let messageBox = getMessageBox(timestamp);
    if (messageBox) continue;

    let datas = past_paragraphs[timestamp];

    // Restore past paragraphs
    messageBox = createMessageBox(datas["speakerName"], timestamp);

    let transcript, summaryArr, confArr, name, hasSummary;
    let newsum = '';

    if (Object.keys(datas["editTrans"]).length === 0) {
      if (datas["naver"].length) {
        transcript = datas["naver"].join(' ')
      }
      else {
        transcript = datas["ms"].join(' ')
      }

      if (Object.keys(datas["sum"]).length === 0) hasSummary = false;
      else {
        hasSummary = true;
        summaryArr = datas["sum"]["summaryArr"]
        confArr = datas["sum"]["confArr"]
        name = datas["speakerName"]
      }
    }
    else {
      var lastKey = Object.keys(datas["editTrans"])[Object.keys(datas["editTrans"]).length - 1];
      transcript = datas["editTrans"][lastKey]["content"]

      hasSummary = true;
      summaryArr = datas["editTrans"][lastKey]["sum"][0];
      confArr = datas["editTrans"][lastKey]["sum"][1];
      name = datas["speakerName"];
    }

    if (Object.keys(datas["editSum"]).length !== 0) {
      var lastKey = Object.keys(datas["editSum"])[Object.keys(datas["editSum"]).length - 1];
      newsum = datas["editSum"][lastKey]["content"]
    }

    // Append the new transcript to the old paragraph.
    let paragraph = messageBox.childNodes[3].childNodes[1];
    paragraph.textContent = transcript;

    if (hasSummary) {
      onSummary(summaryArr, confArr, name, timestamp);
    }
    else {
      let abSummaryBox = messageBox.childNodes[1];
      abSummaryBox.childNodes[0].textContent = "[자막 생성 중...]"
      abSummaryBox.childNodes[1].textContent = transcript;
    }

    if (newsum !== '') {
      onUpdateSummary("absum", newsum, timestamp);
    }

    // Restore pinned message box
    if (datas["pinned"]) {
      pinBox(timestamp);
    }

    // Filtering with new message box
    displayUnitOfBox();
  }
}

function onUpdateSummary(type, content, timestamp) {
  // Use updateSummary function for pin, addkey, delkey
  if (type === "pin") {
    pinBox(timestamp);
    return;
  }
  // else if (type === "addkey") {
  //   addKeywordHelper(content, timestamp);
  //   return;
  // }
  // else if (type === "delkey") {
  //   removeKeywordHelper(content, timestamp);
  //   return;
  // }

  let messageBox = document.getElementById(timestamp.toString());
  let summaryEl = null;
  let msg = 'New summary contents: ' + timestamp + '\n';
  if (type == "absum") {
    summaryEl = messageBox.childNodes[1];
    msg = msg + '                [AbSummary] ' + content + '\n';
  }

  // if user change summary, confidence score == 1
  let speaker = messageBox.childNodes[0].childNodes[0].childNodes[0].textContent;
  if (user_name === speaker) { messageBox.style.background = SureMessage_Mycolor; }
  else { messageBox.style.background = SureMessage_Othercolor; }

  rc.addUserLog(Date.now(), 'UPDATE-SUMMARY-MESSAGEBOX/TIMESTAMP=' + timestamp + '/NEW-SUMMARY=' + content + "/OLD-SUMMARY=" + summaryEl.childNodes[1].textContent + '\n');

  summaryEl = messageBox.childNodes[1];
  let confidenceElem = confidenceElement(1); // if user change summary, confidence score would be 100 % 
  summaryEl.childNodes[0].textContent = "[요약]"
  summaryEl.childNodes[0].append(confidenceElem);
  summaryEl.childNodes[1].textContent = content;

  if (messageBox.getAttribute("pinned") === "true") {
    let pinbox = document.getElementById("pin" + timestamp.toString());
    pinbox.childNodes[1].textContent = content;
  }

  let keywordBox = messageBox.childNodes[2];
  let keyList = keywordBox.childNodes;
  for (var key of keyList) {
    if (key.textContent.charAt(0) === "#") {
      if (!(content.includes(key.textContent.slice(1)))) {
        key.style.display = "none";
      }
    }
  }
  addEditBtn(summaryEl.childNodes[1], type, timestamp);
}

function onRemoveMsg(timestamp) {
  console.log("ON RemoveMsg - timestamp = ", timestamp);
  let messageBox = getMessageBox(timestamp);
  if (messageBox) {
    messageBox.remove();
  }
}

// Event listener on individual transcript arrival.
function onTranscript(transcript, name, timestamp) {
  console.log("ON TRANSCRIPT - timestamp=" + timestamp);
  if (!transcript || transcript.trim().length == 0) {
    console.log("EMPTY TRANSCRIPT!!! REMOVE MSG BOX FROM ", name, " at ", timestamp);
    onRemoveMsg(timestamp);
    return;
  }
  let messageBox = getMessageBox(timestamp);
  if (!messageBox) {
    messageBox = createMessageBox(name, timestamp);
  }

  // Append the new transcript to the old paragraph.
  let paragraph = messageBox.childNodes[3].childNodes[1];
  paragraph.textContent = transcript;

  let abSummaryBox = messageBox.childNodes[1];
  abSummaryBox.childNodes[0].textContent = "[자막 생성 중...]"
  abSummaryBox.childNodes[1].textContent = transcript;

  // Filtering with new message box
  displayUnitOfBox();

  // Scroll down the messages area.
  let scrolldownbutton = document.getElementById("scrollbtn");
  if (messages.scrollTop + messages.clientHeight + messageBox.clientHeight + 20 > messages.scrollHeight) {
    messages.scrollTop = messages.scrollHeight;
    scrolldownbutton.style.display = "none"
  }
  else {
    scrolldownbutton.style.display = "";
  }

}

// Event listener on summary arrival.
function onSummary(summaryArr, confArr, name, timestamp) {
  console.log("ON SUMMARY - timestamp=" + timestamp);
  let messageBox = getMessageBox(timestamp);
  if (!messageBox) {
    messageBox = createMessageBox(name, timestamp);
  }
  // Filtering with new message box
  displayUnitOfBox();

  if (summaryArr[0].trim().length == 0) {
    console.log("No summary:: Delete msg box: ", timestamp);
    onRemoveMsg(timestamp);
  }

  if (confArr[0] < 0.66) {
    messageBox.style.background = UnsureMessage_color;
  }

  let seeFullText = messageBox.childNodes[3].childNodes[0];
  seeFullText.style.display = "block";
  let paragraph = messageBox.childNodes[3].childNodes[1];
  paragraph.style.display = "none";

  let fav_word = [];
  let newAlarm = document.createElement("p");
  newAlarm.style.backgroundColor = "#fffaa3";
  newAlarm.style.fontSize = "medium";
  newAlarm.style.marginBottom = "2px";
  newAlarm.style.padding = "5px 5px";
  newAlarm.style.border = "1px solid grey";
  newAlarm.style.margin = "5px 5px 3px 5px"
  newAlarm.textContent = "즐겨찾기를 포함한 새로운 메시지가 추가되었습니다!";

  for (var word of favoriteKeywords) {
    if (paragraph.textContent.includes(word)) {
      fav_word.push(word);
    }
  }
  if (fav_word.length > 0) {
    notiAudio.play();
    let rightDisplay = document.getElementById("display-choice");
    for (var word of fav_word) {
      newAlarm.textContent += " #" + word;
    }
    setTimeout(function () {
      newAlarm.parentNode.removeChild(newAlarm);
    }, 10000);
    rightDisplay.appendChild(newAlarm);
  }


  let abSummaryBox = messageBox.childNodes[1];
  let keywordBox = messageBox.childNodes[2];
  var keywordList = summaryArr[2].split("@@@@@CD@@@@@AX@@@@@");
  keywordList = keywordList.filter(item => item);
  keywordMap[timestamp.toString()] = keywordList;

  for (let keyword of keywordList) {
    addKeywordBlockHelper(timestamp, keyword);
  }

  /*
  // Add button for deleting keywords
  var delKeywordBtn = document.createElement("button");
  var delImage = document.createElement("i");
  delImage.className = "fas fa-minus";
  delImage.style.color = "black";
  delKeywordBtn.style.backgroundColor = "transparent";
  delKeywordBtn.style.border = 0;
  delKeywordBtn.style.display = "inline-block";
  delKeywordBtn.style.float = "right";
  delKeywordBtn.setAttribute("state", "off");
  delKeywordBtn.onclick = function () { delKeyword(timestamp, this); };
  delKeywordBtn.append(delImage);
  keywordBox.append(delKeywordBtn);

  // Add button for adding keywords
  var addKeywordBtn = document.createElement("button");
  var addImage = document.createElement("i");
  addImage.className = "fas fa-plus";
  addImage.style.color = "black";
  addKeywordBtn.style.backgroundColor = "transparent";
  addKeywordBtn.style.border = 0;
  addKeywordBtn.style.display = "inline-block";
  addKeywordBtn.style.float = "right";
  addKeywordBtn.onclick = function () { addKeyword(keywordBox, timestamp); };
  addKeywordBtn.append(addImage);
  keywordBox.append(addKeywordBtn);
  */

  // Add buttons for trending keywords
  var trendingList = summaryArr[3].split("@@@@@CD@@@@@AX@@@@@");
  var trendingBtns = [trending_1, trending_2, trending_3, trending_4, trending_5, trending_6, trending_7, trending_8, trending_9, trending_10];
  let i = 0;
  for (let trendBtn of trendingBtns) {
    if (trendingList[i]) {
      trendBtn.textContent = "#" + trendingList[i];
      trendBtn.style.display = "inline-block";
    }
    else {
      trendBtn.style.display = "none";
    }
    i++;
  }

  // If confidence === -1, the summary result is only the paragraph itself.
  // Do not put confidence element as a sign of "this is not a summary"
  abSummaryBox.childNodes[0].textContent = "[요약]";
  abSummaryBox.childNodes[1].textContent = summaryArr[0];

  if (confArr[0] !== -1) {
    let confidenceElem = confidenceElement(confArr[0]);
    abSummaryBox.childNodes[0].append(confidenceElem);
  }

  // Add edit button in order to allow user change contents (paragraph, absummary, exsummary)
  // let paragraph = messageBox.childNodes[3].childNodes[0];
  addEditBtn(paragraph, "paragraph", timestamp);
  addEditBtn(abSummaryBox.childNodes[1], "absum", timestamp);

  // Scroll down the messages area.
  let scrolldownbutton = document.getElementById("scrollbtn");
  if (messages.scrollTop + messages.clientHeight + messageBox.clientHeight + 20 > messages.scrollHeight) {
    messages.scrollTop = messages.scrollHeight;
    scrolldownbutton.style.display = "none"
  }
  else {
    scrolldownbutton.style.display = "";
  }


}

/*
// Helper function for adding new keywords
function addKeyword(box, timestamp) {
  console.log("Add keyword for messagebox");
  var keyInputSpan = document.createElement("span");
  var keyInput = document.createElement("input");
  keyInput.style.fontSize = "small";
  keyInput.style.marginLeft = "5px";
  keyInput.placeholder = "입력해주세요";
  keyInput.addEventListener('keypress', async e => {
    if (e.code === 'Enter') {
      rc.addUserLog(Date.now(), "ADD-KEYWORD/MSG=" + keyInput.value + "/TIMESTAMP=" + timestamp + "\n");
      rc.updateSummary(Date.now(), "addkey", keyInput.value, timestamp);
      keyInputSpan.remove();
    }
  });

  let exBtn = document.createElement("button");
  let exImg = document.createElement("i");
  exImg.setAttribute("class", "fas fa-times-circle");
  exImg.style.color = "gray";
  exBtn.style.backgroundColor = "transparent";
  exBtn.style.border = "none";
  exBtn.style.margin = "0px 0px 0px 3px";
  exBtn.style.padding = "0px 0px 0px 0px";
  exImg.style.margin = "0px 0px 0px 0px";
  exImg.style.padding = "0px 0px 0px 0px";
  exBtn.append(exImg);
  exBtn.onclick = function () {
    this.parentNode.remove();
  };
  keyInputSpan.append(keyInput);
  keyInputSpan.append(exBtn);
  box.append(keyInputSpan);
  keyInput.focus();
}

// Helper function for adding a new keyword in message box
function addKeywordHelper(keyword, timestamp) {
  let messageBox = document.getElementById(timestamp.toString());
  let keywordBox = messageBox.childNodes[2];
  var newKeyword = document.createElement("p");
  newKeyword.textContent = '#' + keyword;
  newKeyword.className = "keyword-btn";
  newKeyword.setAttribute("id", timestamp.toString() + '@@@' + keyword);
  let delBtn = document.createElement("button");
  delBtn.className = "fas fa-times";
  delBtn.style.backgroundColor = "transparent";
  delBtn.style.border = 0;
  delBtn.style.display = "none";
  delBtn.onclick = function () {
    rc.addUserLog(Date.now(), "DELETE-KEYWORD/MSG=" + keyword + "/TIMESTAMP=" + timestamp + "\n");
    removeKeyword(this.parentNode, timestamp);
  };
  newKeyword.append(delBtn);
  newKeyword.style.display = "inline-block";
  newKeyword.style.padding = "0px 3px 0px 3px";
  newKeyword.style.border = "1px solid #6b787e";
  newKeyword.style.borderRadius = "5px";
  newKeyword.style.margin = "0px 5px 2px 0px";

  if (favoriteKeywords.includes(keyword)) {
    newKeyword.style.backgroundColor = "#fed7bf";
  }
  else {
    newKeyword.style.backgroundColor = "transparent";
  }
  keywordBox.append(newKeyword);
  keywordMap[timestamp.toString()].push(keyword);
}

function delKeyword(timestamp, delKeywordBtn) {
  let messageBox = document.getElementById(timestamp.toString());
  let keywordBox = messageBox.childNodes[2];
  let state = delKeywordBtn.getAttribute("state");
  if (state === "off") {
    delKeywordBtn.innerHTML = "완료";
    let keyList = keywordBox.childNodes;
    for (var key of keyList) {
      if (key.tagName === "P") {
        key.childNodes[1].style.display = "";
      }
    }
    delKeywordBtn.setAttribute("state", "on");
  } else {
    let delImage = document.createElement("i");
    delImage.className = "fas fa-minus";
    delImage.style.color = "black";
    delKeywordBtn.innerHTML = "";
    delKeywordBtn.append(delImage);
    let keyList = keywordBox.childNodes;
    for (var key of keyList) {
      if (key.tagName === "P") {
        key.childNodes[1].style.display = "none";
      }
    }
    delKeywordBtn.setAttribute("state", "off");
  }
}

function removeKeyword(keywordBtn, timestamp) {
  let keyword = keywordBtn.textContent.slice(1);
  rc.updateSummary(Date.now(), "delkey", keyword, timestamp);
}

function removeKeywordHelper(keyword, timestamp) {
  let keywordBtn = document.getElementById(timestamp.toString() + '@@@' + keyword);
  let msgKeyList = keywordMap[timestamp.toString()];
  let idx = msgKeyList.indexOf(keyword);
  msgKeyList.splice(idx, 1);
  keywordBtn.remove();
}
*/

function addKeywordBlockHelper(timestamp, keyword) {
  let msgBox = getMessageBox(timestamp);
  let keywordBox = msgBox.childNodes[2];
  let keywordBtn = document.createElement("p");
  keywordBtn.className = "keyword-btn";
  keywordBtn.setAttribute("id", timestamp.toString() + '@@@' + keyword);
  keywordBtn.textContent = "#" + keyword;
  keywordBtn.style.display = "inline-block";
  keywordBtn.style.fontSize = "small";
  keywordBtn.style.padding = "0px 5px 0px 3px";
  keywordBtn.style.border = "1px solid #6b787e";
  keywordBtn.style.borderRadius = "5px";
  let delBtn = document.createElement("button");
  delBtn.className = "fas fa-times";
  delBtn.style.backgroundColor = "transparent";
  delBtn.style.border = 0;
  delBtn.onclick = function () {
    rc.addUserLog(Date.now(), "DELETE-KEYWORD/MSG=" + keyword + "/TIMESTAMP=" + timestamp + "\n");
    removeKeyword(this.parentNode, timestamp)
  };
  delBtn.style.display = "none";
  keywordBtn.append(delBtn);

  if (favoriteKeywords.includes(keyword)) {
    keywordBtn.style.backgroundColor = "#fed7bf";
  }
  else {
    keywordBtn.style.backgroundColor = "transparent";
  }
  keywordBtn.style.margin = "0px 5px 2px 0px";
  keywordBox.append(keywordBtn);
}

function toEditableBg(p) {
  p.style.background = "none";
}

function toEditingBg(p) {
  p.style.background = "aliceblue";
}

function toEditableIcon(btn) {
  btn.style.opacity = "0.5";
  btn.childNodes[0].className = "fas fa-pen";
}

function toEditingIcon(btn) {
  btn.style.opacity = "0.8";
  btn.childNodes[0].className = "fas fa-check";
}

function editContent(type, timestamp) {
  let messageBox = document.getElementById(timestamp.toString());
  let oldtxt = null;
  switch (type) {
    case "paragraph":
      let paragraph = messageBox.childNodes[3].childNodes[1];
      paragraph.contentEditable = "true";
      paragraph.addEventListener("keydown", function (event) {
        // event.preventDefault();
        if (event.keyCode === 13) {
          finishEditContent("paragraph", oldtxt, timestamp);
        }
      });

      // change icon
      console.log(paragraph);
      console.log(paragraph.childNodes[1]);

      toEditingBg(paragraph)
      toEditingIcon(paragraph.childNodes[1])

      oldtxt = paragraph.textContent;
      paragraph.childNodes[1].onclick = function () { finishEditContent("paragraph", oldtxt, timestamp); };

      break;
    case "absum":
      let abSummary = messageBox.childNodes[1].childNodes[1];
      abSummary.contentEditable = "true";
      abSummary.addEventListener("keydown", function (event) {
        if (event.keyCode === 13) {
          finishEditContent("absum", oldtxt, timestamp);
        }
      });

      // change icon
      console.log(abSummary);
      console.log(abSummary.lastChild);

      toEditingBg(abSummary)
      toEditingIcon(abSummary.lastChild)

      oldtxt = abSummary.textContent;

      abSummary.lastChild.onclick = function () { finishEditContent("absum", oldtxt, timestamp); };
      break;
  }
}

function finishEditContent(type, oldtxt, timestamp) {
  let messageBox = document.getElementById(timestamp.toString());
  console.log(oldtxt)

  let editTimestamp = Date.now();

  switch (type) {
    case "paragraph":
      let paragraph = messageBox.childNodes[3].childNodes[1];
      console.log(paragraph.textContent);
      toEditableBg(paragraph);
      paragraph.contentEditable = "false";

      if (oldtxt.valueOf() != paragraph.textContent.valueOf()) {
        // update paragraph and summary on all users
        rc.updateParagraph(editTimestamp, paragraph.textContent, timestamp, messageBox.childNodes[0].childNodes[0].textContent);
        paragraph.style.backgroundColor = "#f2f2f2";
        rc.addUserLog(editTimestamp, 'FINISH-EDIT-PARAGRAPH' + '/TYPE=' + type + '/PARAGRAPH=' + messageBox.childNodes[0].childNodes[0].textContent
          + '/OLDPARAGRAPH=' + oldtxt
          + '/TIMESTAMP=' + timestamp + '\n');
      }
      else {
        // change icon
        console.log(paragraph);
        console.log(paragraph.childNodes[1]);
        toEditableIcon(paragraph.childNodes[1])

        paragraph.childNodes[1].onclick = function () { editContent(type, timestamp); };
        paragraph.style.backgroundColor = "#f2f2f2";
        rc.addUserLog(editTimestamp, 'CANCEL-EDIT-PARAGRAPH/TYPE=' + type + '/TIMESTAMP=' + timestamp + '\n');
      }
      break;
    default:
      let summary = null;
      if (type == "absum") {
        summary = messageBox.childNodes[1].childNodes[1];
      }
      toEditableBg(summary);
      summary.contentEditable = "false";

      if (oldtxt != summary.textContent) {
        rc.updateSummary(editTimestamp, "absum", summary.textContent, timestamp)
        rc.addUserLog(editTimestamp, 'FINISH-EDIT-SUMMARY' + "/TYPE=" + type + '/SUMMARY=' + summary.textContent +
          '/OLDSUMMARY=' + oldtxt +
          '/TIMESTAMP=' + timestamp + "\n");
      }
      else {
        toEditableIcon(summary.lastChild)
        summary.lastChild.onclick = function () { editContent(type, timestamp); };
        rc.addUserLog(editTimestamp, 'CANCEL-EDIT-SUMMARY/TYPE=' + type + '/TIMESTAMP=' + timestamp + '\n');
      }
      break;
  }
}

// Display boxes with trending keywords
function displayTrendingHelper(keywordBtn) {
  let searchword = document.getElementById("search-word");
  searchword.value = keywordBtn.textContent.slice(1);
  removeSummaryBox();
  displayUnitOfBox();
  rc.addUserLog(Date.now(), 'SEARCH-TRENDINGWORDS/MSG=' + searchword.value + '\n');
}

var highlighter = new Hilitor();

function addSearchLog() {
  console.log("addSearchLog")
  let searchword = document.getElementById("search-word").value.trim();
  rc.addUserLog(Date.now(), 'SEARCH-WORD/MSG=' + searchword + '\n');
}

function displayUnitOfBox() {
  let searchword = document.getElementById("search-word").value.trim();
  let messageBoxes = document.getElementsByClassName("message-box");
  let paragraphs = document.getElementsByClassName("paragraph");

  if (favoriteKeywords.includes(searchword)) {
    keywordParagraph = "";
    for (var i = 0; i < messageBoxes.length; i++) { // access each i-th index of boxes at the same time
      let isfiltered = paragraphs[i].textContent.includes(searchword.trim());
      let messageBox = messageBoxes[i];
      if (isfiltered) {
        keywordParagraph += " " + messageBox.childNodes[3].childNodes[1].textContent;
      }
      displayBox(true && isfiltered, messageBox, displayYes);
    }
  }
  else {
    for (var i = 0; i < messageBoxes.length; i++) {
      let isfiltered = paragraphs[i].textContent.includes(searchword.trim());
      let messageBox = messageBoxes[i];
      displayBox(true && isfiltered, messageBox, displayYes);
    }
  }

  // highlight with search-word
  if (searchword == "") {
    if (highlighter) {
      highlighter.remove();
    }
  } else {
    highlighter.apply(searchword);
  }
}

function scrollDown() {
  messages.scrollTop = messages.scrollHeight;

  let scrolldownbutton = document.getElementById("scrollbtn");
  scrolldownbutton.style.display = "none"
}
//////////////////////////////////////////////
/************* Helper functions *************/

// Type in new favorite keyword
function addFavorite() {
  let addFavBtn = document.getElementById("add-fav-keyword");
  addFavBtn.style.backgroundColor = "lightgray";

  let keywordList = document.getElementById("favorites");
  var keyInputSpan = document.createElement("span");
  var keyInput = document.createElement("input");
  keyInput.style.fontSize = "small";
  keyInput.style.margin = "3px 0px 0px 5px";
  keyInput.style.padding = "0px 3px 0px 3px";
  keyInput.style.width = "100px";
  keyInput.placeholder = "입력해주세요.";

  keyInput.addEventListener('keypress', async e => {
    if (e.code === 'Enter') {
      rc.addUserLog(Date.now(), "ADD-FAVORITE/MSG=" + keyInput.value + "\n");
      favoriteKeywords.push(keyInput.value);
      let myKeyword = document.createElement("button");
      myKeyword.setAttribute("id", keyInput.value);
      myKeyword.className = "favoriteKeyword";
      myKeyword.innerHTML = "#" + keyInput.value;
      myKeyword.style.fontSize = "smaller";
      myKeyword.style.padding = "1px 3px 1px 3px";
      myKeyword.style.backgroundColor = "#fed7bf";
      myKeyword.style.margin = "0px 5px 0px 0px";
      myKeyword.style.borderRadius = "5px";
      myKeyword.style.border = "1px solid black";
      myKeyword.style.display = "inline-block";
      checkBoxWithKey(keyInput.value);
      myKeyword.onclick = function () { searchFavorite(keyInput.value); };
      keyInputSpan.remove();
      addFavBtn.style.backgroundColor = "transparent";
      keywordList.append(myKeyword);
    }
  });

  let exBtn = document.createElement("button");
  let exImg = document.createElement("i");
  exImg.setAttribute("class", "fas fa-times-circle");
  exImg.style.color = "gray";
  exBtn.style.backgroundColor = "transparent";
  exBtn.style.border = "none";
  exBtn.style.margin = "0px 0px 0px 3px";
  exBtn.style.padding = "0px 0px 0px 0px";
  exImg.style.margin = "0px 0px 0px 0px";
  exImg.style.padding = "0px 0px 0px 0px";
  exBtn.append(exImg);
  exBtn.onclick = function () {
    this.parentNode.remove();
    addFavBtn.style.backgroundColor = "transparent";
  };

  keyInputSpan.append(keyInput);
  keyInputSpan.append(exBtn);
  keywordList.append(keyInputSpan);
  keyInput.focus();
}

// Delete favorite keyword
function delFavorite() {
  let keys = document.getElementsByClassName("favoriteKeyword");
  let delKey = document.getElementById("del-fav-keyword");
  if (delKey.getAttribute("state") === "off") {
    delKey.textContent = "완료";
    delKey.style.backgroundColor = "lightgray";
    for (var key of keys) {
      key.style.backgroundColor = "red";
      key.onclick = function () {
        var idx = favoriteKeywords.indexOf(this.textContent.slice(1));
        favoriteKeywords.splice(idx, 1);
        undoColorKeys(this.textContent.slice(1));
        rc.addUserLog(Date.now(), "DELETE-FAVORITE/MSG=" + this.textContent.slice(1) + "\n");
        this.remove();
      };
    }
    delKey.setAttribute("state", "on");
  }
  else {
    let delImage = document.createElement("i");
    delImage.className = "fas fa-minus";
    delKey.innerHTML = "";
    delKey.append(delImage);
    delKey.innerHTML += "삭제";
    delKey.style.backgroundColor = "transparent";
    for (var key of keys) {
      key.style.backgroundColor = "#fed7bf";
      key.onclick = function () { searchFavorite(key.textContent.slice(1)); };
    }
    delKey.setAttribute("state", "off");
  }
}

// Find previous boxes containing the deleted keyword & remove the colors
function undoColorKeys(keyword) {
  let messageBoxes = document.getElementsByClassName("message-box");
  for (var i = 0; i < messageBoxes.length; i++) {
    let messageBox = messageBoxes[i];
    let keywordBox = messageBox.childNodes[2];
    for (var keyBtn of keywordBox.childNodes) {
      if ((keyBtn.className === "keyword-btn") && (keyBtn.textContent.slice(1) === keyword)) {
        keyBtn.style.backgroundColor = "transparent";
      }
    }
  }
}

// Click favorite keyword button
function searchFavorite(keyword) {
  removeSummaryBox();
  let searchword = document.getElementById("search-word");
  searchword.value = keyword;
  displayUnitOfBox();
  createSummaryBox(keyword);
  let editTimestamp = Date.now();
  rc.addUserLog(Date.now(), "SEARCH-FAVORITE/MSG=" + keyword + "\n");
  rc.updateParagraph(editTimestamp, keywordParagraph, "summary-for-keyword@@@" + user_name, "OVERALL@@@" + keyword);
}

// Finds previous boxes containing the new keyword & colors it
function checkBoxWithKey(keyword) {
  let messageBoxes = document.getElementsByClassName("message-box");
  for (var i = 0; i < messageBoxes.length; i++) {
    let messageBox = messageBoxes[i];
    let keywordBox = messageBox.childNodes[2];
    for (keywordBtn of keywordBox.childNodes) {
      if ((keywordBtn.className === "keyword-btn") && (keywordBtn.textContent.slice(1) === keyword)) {
        keywordBtn.style.backgroundColor = "#fed7bf";
      }
    }
  }
}

// Show the overall summary for each thread (favorite keyword)
function createSummaryBox(keyword) {
  let summaryBox = document.createElement("div");
  summaryBox.setAttribute("id", "summary-for-keyword");
  summaryBox.className = "summary-box";

  // summaryBox.childNodes[0]: Includes the keyword
  let title = document.createElement("div");
  let nametag = document.createElement("span");
  let strong = document.createElement("strong");
  strong.textContent = "[ #" + keyword + " 을 포함한 문장]";
  nametag.className = "nametag";
  nametag.append(strong);
  title.append(nametag);
  summaryBox.append(title);

  // summaryBox.childNodes[1]: Includes abstract summary
  let abSummaryBox = document.createElement("div");
  let abSummary = document.createElement("p");
  abSummary.textContent = "Processing overall summary...";
  abSummaryBox.style.fontSize = "medium";
  abSummaryBox.style.marginLeft = "5px";
  abSummaryBox.style.marginTop = "1em";
  abSummaryBox.append(abSummary);
  summaryBox.append(abSummaryBox);

  messages.insertBefore(summaryBox, messages.firstChild);
  summaryBox.scrollIntoView(true);
  return summaryBox;
}

// Helper function for searching when ENTER keydown
function checkEnter(e) {
  if (e.code === 'Enter') {
    console.log("Enter press on search!");
    removeSummaryBox();
    addSearchLog();
    displayUnitOfBox();
  }
}

// Remove existing summaryBox
function removeSummaryBox() {
  let summaryBox = document.getElementById("summary-for-keyword");
  if (summaryBox) {
    summaryBox.remove();
  }
}

// Delete text in search box & Display all boxes
function showAllBoxes() {
  let searchWord = document.getElementById("search-word");
  searchWord.value = "";
  removeSummaryBox();
  displayUnitOfBox();
}

// Change given box's css style to bigger text
function displayBig(box) {
  box.style.marginLeft = "";
  box.style.fontSize = "medium";
  box.style.display = "";
}

// Reduce size of box and add left margin
function displaySm(box) {
  box.style.marginLeft = "1em";
  box.style.fontSize = "smaller";
  box.style.display = "";
}

// Hide box
function displayNo(box) {
  box.style.display = "none";
}

// Show box
function displayYes(box) {
  box.style.display = "";
}

// Disply box if 'cond' is true, use given function 'fn' to show the box
function displayBox(cond, box, fn) {
  if (cond) {
    fn(box);
  }
  else {
    displayNo(box);
  }
}

// Display boxes if 'cond' is true, use given function 'fn' to show the box
function displayBoxes(cond, boxes, fn) {
  for (let box of boxes) {
    displayBox(cond, box, fn);
  }
}

// Creates a container element (message box)
// that holds a paragraph and its summary.
// The timestamp acts as an identifier for the element.
function createMessageBox(name, timestamp) {
  let messageBox = document.createElement("div");
  messageBox.setAttribute("id", timestamp.toString());
  messageBox.className = "message-box";

  if (user_name == name) {
    messageBox.style.borderBottom = "0.001em solid rgba(40, 70, 167, 0.5)";
    messageBox.style.background = SureMessage_Mycolor;
  }

  // messageBox.childNodes[0]: includes title - timestamp and name.
  let title = document.createElement("div");
  let nametag = document.createElement("span");
  let strong = document.createElement("strong");
  strong.textContent = name;
  nametag.className = "nametag";
  nametag.append(strong);

  let timetag = document.createElement("span");
  timetag.className = "timetag";
  timetag.append(document.createTextNode(formatTime(timestamp)));
  title.append(nametag, timetag);

  // Add pin button
  let pinBtn = document.createElement("button");
  let pin = document.createElement("i");
  pin.className = "fas fa-thumbtack";
  pin.style.color = "#F2F3F4";
  pinBtn.append(pin);
  pinBtn.style.backgroundColor = "transparent";
  pinBtn.style.border = "0";
  pinBtn.style.float = "right";
  pinBtn.style.display = "inline-block";
  messageBox.setAttribute("pinned", "false");
  pinBtn.onclick = function () {
    rc.updateSummary(Date.now(), "pin", "pinBox", timestamp);
    if (messageBox.getAttribute("pinned") === "false") { rc.addUserLog(Date.now(), "PIN-BOX/TIMESTAMP=" + timestamp.toString() + "\n"); }
    else { rc.addUserLog(Date.now(), "UNPIN-BOX/TIMESTAMP=" + timestamp.toString() + "\n"); }
  };

  title.append(pinBtn);
  messageBox.append(title);

  // messageBox.childNodes[1]: includes the abstractive summary and confidence level
  let abSummaryBox = document.createElement("div");
  abSummaryBox.className = "ab-summary-box";
  abSummaryBox.style.fontSize = "medium";
  abSummaryBox.style.marginLeft = "5px";
  abSummaryBox.style.marginTop = "1em";

  let abSummaryTitle = document.createElement("p");
  let abSummaryContent = document.createElement("p");

  abSummaryBox.append(abSummaryTitle);
  abSummaryBox.append(abSummaryContent);

  messageBox.append(abSummaryBox);

  // messageBox.childNodes[2]: includes the keywords
  let keywordBox = document.createElement("div");
  keywordBox.className = "keyword-box";
  keywordBox.style.fontSize = "smaller";
  keywordBox.style.marginLeft = "5px";
  keywordBox.style.marginBottom = "5px";
  messageBox.append(keywordBox);

  // messageBox.childNodes[3]: childNodes[0] = Button, childNodes[1] = Full paragraph
  let paragraphBox = document.createElement("div");

  let seeFullText = document.createElement("button");
  seeFullText.className = "seeFullText";
  seeFullText.style.fontSize = "x-small";
  seeFullText.style.display = "none";
  seeFullText.style.border = "0";
  seeFullText.style.backgroundColor = "transparent";
  seeFullText.style.marginTop = "5px";
  seeFullText.innerHTML = "<u>See full text</u>";
  seeFullText.onclick = function () { showFullText(timestamp); };
  paragraphBox.append(seeFullText);

  let paragraph = document.createElement("p");
  paragraph.className = "paragraph";
  paragraph.style.fontSize = "smaller";
  paragraph.style.backgroundColor = "#f2f2f2";
  paragraph.style.borderRadius = "5px";
  paragraph.style.marginTop = "5px";
  paragraph.style.padding = "5px";
  paragraph.style.border = "1px solid #d4d4d4";
  paragraph.style.display = "none";
  paragraphBox.append(paragraph);

  messageBox.append(paragraphBox);

  // Finally append the box to 'messages' area
  let lastchild = true;
  for (var box of messages.childNodes) {
    if (Number(box.id) > timestamp) {
      messages.insertBefore(messageBox, box);
      lastchild = false;
      break;
    }
  }
  if (lastchild) {
    messages.appendChild(messageBox);
  }
  return messageBox;
}

// Pins message box
function pinBox(timestamp) {
  let stringTime = timestamp.toString();
  let messageBox = document.getElementById(stringTime);
  let pinBtn = messageBox.childNodes[0].childNodes[2];
  let dropdownPin = document.getElementById("dropdownPin");
  let newPin = document.createElement("a");

  if (messageBox.getAttribute("pinned") === "false") {
    messageBox.setAttribute("pinned", "true");
    newPin.setAttribute("id", "pin" + stringTime);
    newPin.href = "#";
    newPin.addEventListener('click', function () {
      rc.addUserLog(Date.now(), "CLICK-PIN/TIMESTAMP=" + stringTime + "\n");
      console.log("CLICK-PIN -> TIMESTAMP=" + stringTime, messageBox, messageBox.offsetTop, messageBox.offsetHeight);
      messageBox.scrollIntoView(false);
    });
    newPin.style.padding = "2px 2px 2px 2px";
    newPin.style.backgroundColor = "#ffffff";
    newPin.style.border = "0.1px solid #d4d4d4";
    newPin.style.fontSize = "smaller";
    newPin.style.color = "#000000";
    newPin.style.float = "left";
    newPin.style.width = "250px";
    newPin.style.overflow = "auto";
    newPin.style.textAlign = "left";
    newPin.style.textDecoration = "none";
    newPin.style.overflowX = "hidden";
    let name = document.createElement("strong");
    name.textContent = "[" + messageBox.childNodes[0].childNodes[0].childNodes[0].textContent + "] ";
    name.style.marginLeft = "5px";
    let textCont = document.createElement("p");
    textCont.textContent = messageBox.childNodes[1].childNodes[1].textContent.substr(0, 50) + " ...";
    textCont.style.margin = "3px 5px 3px 5px";
    newPin.append(name);
    newPin.append(textCont);
    dropdownPin.append(newPin);
    pinBtn.childNodes[0].style.color = "#000000";
  }
  else {
    messageBox.setAttribute("pinned", "false");
    let delPin = document.getElementById("pin" + stringTime);
    delPin.remove();
    pinBtn.childNodes[0].style.color = "#F2F3F4";
  }
}

function showPinBoxes() {
  let pinClick = document.getElementById("dropdownPin");
  if (pinClick.style.display === "none") {
    rc.addUserLog(Date.now(), "PIN-DROPDOWN-PIN-OPEN\n");
    pinClick.style.display = "block";
  }
  else {
    rc.addUserLog(Date.now(), "PIN-DROPDOWN-CLOSE\n");
    pinClick.style.display = "none";
  }
}

// Shows the full paragraph in each message box
function showFullText(timestamp) {
  let messageBox = document.getElementById(timestamp.toString());

  if (messageBox.childNodes[3].childNodes[1].style.display == "") {
    rc.addUserLog(Date.now(), 'CLICK-HIDE-FULL-TEXT/TIMESTAMP=' + timestamp.toString() + '\n');
    messageBox.childNodes[3].childNodes[1].style.display = "none";
    messageBox.childNodes[3].childNodes[0].innerHTML = "<u>See full text</u>";
  }
  else {
    rc.addUserLog(Date.now(), 'CLICK-SEE-FULL-TEXT/TIMESTAMP=' + timestamp.toString() + '\n');
    messageBox.childNodes[3].childNodes[1].style.display = "";
    messageBox.childNodes[3].childNodes[0].innerHTML = "<u>Hide full text</u>";
  }
}

// Gets an existing message box that matches given timestamp.
function getMessageBox(timestamp) {
  return document.getElementById(timestamp.toString());
}

// Formats time from a timestamp in hh:mm:ss AM/PM format.
function formatTime(timestamp) {
  console.log("formatTime");
  console.log(Number(timestamp));
  let date = new Date(Number(timestamp));
  console.log(date);

  // Appends leading zero for one-digit hours, minutes, and seconds
  function appendZero(time) {
    return time < 10 ? "0" + time : time.toString();
  }

  let hours = appendZero(date.getHours() % 12);
  let ampm = date.getHours() < 12 ? "AM" : "PM";
  let minutes = appendZero(date.getMinutes());
  let seconds = appendZero(date.getSeconds());

  return `${hours}:${minutes}:${seconds} ${ampm}`;
}

// Returns a span element that represents confidence level.
function confidenceElement(confidence) {
  let percentage = (confidence * 100).toFixed(1) + "%";
  let emoji = "";
  let color = "";

  if (confidence < 0.33) {
    emoji = " \u{1F641}";
    color = "red";
  } else if (confidence < 0.66) {
    emoji = " \u{1F610}";
    color = "blue";
  } else {
    emoji = " \u{1F600}";
    color = "green";
  }

  let elem = document.createElement("span");
  elem.style.color = color;
  elem.style.fontSize = "smaller";
  elem.textContent = emoji + " " + percentage;

  return elem;
}

////////////////////////////////////////////////////////////////////////////////////
///////////////////////////       HIGHLIGHTER              /////////////////////////
////////////////////////////////////////////////////////////////////////////////////

// Original JavaScript code by Chirp Internet: chirpinternet.eu
// Please acknowledge use of this code by including this header.

function Hilitor(id, tag) {

  // private variables
  var targetNode = document.getElementById(id) || document.body;
  var hiliteTag = tag || "MARK";
  var skipTags = new RegExp("^(?:" + hiliteTag + "|SCRIPT|FORM|SPAN)$");
  var colors = ["#ff6"]
  var wordColor = [];
  var colorIdx = 0;
  var matchRegExp = "";
  var openLeft = false;
  var openRight = false;

  // characters to strip from start and end of the input string
  var endRegExp = new RegExp('^[^\\w]+|[^\\w]+$', "g");

  // characters used to break up the input string into words
  var breakRegExp = new RegExp('[^\\w\'-]+', "g");

  this.setEndRegExp = function (regex) {
    endRegExp = regex;
    return endRegExp;
  };

  this.setBreakRegExp = function (regex) {
    breakRegExp = regex;
    return breakRegExp;
  };

  this.setMatchType = function (type) {
    switch (type) {
      case "left":
        this.openLeft = false;
        this.openRight = true;
        break;

      case "right":
        this.openLeft = true;
        this.openRight = false;
        break;

      case "open":
        this.openLeft = this.openRight = true;
        break;

      default:
        this.openLeft = this.openRight = false;

    }
  };

  this.setRegex = function (input) {
    // input = input.replace(endRegExp, "");
    // input = input.replace(breakRegExp, "|");
    // input = input.replace(/^\||\|$/g, "");
    if (input) {
      // var re = "(" + input + ")";
      // if(!this.openLeft) {
      //   re = "\\b" + re;
      // }
      // if(!this.openRight) {
      //   re = re + "\\b";
      // }
      var re = "(" + input + ")"
      matchRegExp = new RegExp(re, "i");
      return matchRegExp;
    }
    return false;
  };

  this.getRegex = function () {
    var retval = matchRegExp.toString();
    retval = retval.replace(/(^\/(\\b)?|\(|\)|(\\b)?\/i$)/g, "");
    retval = retval.replace(/\|/g, " ");
    return retval;
  };

  // recursively apply word highlighting
  this.hiliteWords = function (node) {
    if (node === undefined || !node) return;
    if (!matchRegExp) return;
    if (skipTags.test(node.nodeName)) return;

    if (node.hasChildNodes()) {
      for (var i = 0; i < node.childNodes.length; i++)
        this.hiliteWords(node.childNodes[i]);
    }
    if (node.nodeType == 3) { // NODE_TEXT
      if ((nv = node.nodeValue) && (regs = matchRegExp.exec(nv))) {
        if (!wordColor[regs[0].toLowerCase()]) {
          wordColor[regs[0].toLowerCase()] = colors[colorIdx++ % colors.length];
        }
        var match = document.createElement(hiliteTag);
        match.appendChild(document.createTextNode(regs[0]));
        match.style.backgroundColor = wordColor[regs[0].toLowerCase()];
        match.style.color = "#000";

        var after = node.splitText(regs.index);
        after.nodeValue = after.nodeValue.substring(regs[0].length);
        node.parentNode.insertBefore(match, after);
      }
    };
  };

  // remove highlighting
  this.remove = function () {
    var arr = document.getElementsByTagName(hiliteTag);
    while (arr.length && (el = arr[0])) {
      var parent = el.parentNode;
      parent.replaceChild(el.firstChild, el);
      parent.normalize();
    }
  };

  // start highlighting at target node
  this.apply = function (input) {
    this.remove();
    if (input === undefined || !(input = input.replace(/(^\s+|\s+$)/g, ""))) {
      return;
    }
    if (this.setRegex(input)) {
      this.hiliteWords(targetNode);
    }
    return matchRegExp;
  };

}
