// transcript.js
// Defines event handlers for transcripts from moderator server.
// Includes UI control on transcription and summary data arrival.

const messages = document.getElementById("messages");

moderatorSocket.on("transcript", onTranscript);
moderatorSocket.on("summary", onSummary);

moderatorSocket.on("updateParagraph", onUpdateParagraph);
moderatorSocket.on("updateSummary", onUpdateSummary);

function onUpdateParagraph(newParagraph, summaryArr, confArr, timestamp) {
  let messageBox = document.getElementById(timestamp);
  let paragraph = messageBox.childNodes[1];
  let abSummaryEl = messageBox.childNodes[2].childNodes[0];
  let exSummaryEl = messageBox.childNodes[3].childNodes[0];

  paragraph.textContent = newParagraph;
  abSummaryEl.textContent = "[Abstractive]\n" + summaryArr[0];
  exSummaryEl.textContent = "[Extractive]\n" + summaryArr[1];

  rc.addUserLog(Date.now(), 'New paragraph contents: ' + timestamp + '\n'
    + '                [Paragraph] ' + newParagraph + '\n'
    + '                [AbSummary] ' + summaryArr[0] + '\n'
    + '                [ExSumamry] ' + summaryArr[1] + '\n');

  // If confidence === -1, the summary result is only the paragraph itself.
  // Do not put confidence element as a sign of "this is not a summary"
  if (confArr[0] !== -1) {
    let confidenceElem = confidenceElement(confArr[0]);
    abSummaryEl.append(confidenceElem);
  }
  if (confArr[1] !== -1) {
    let confidenceElem = confidenceElement(confArr[1]);
    exSummaryEl.append(confidenceElem);
  }

  addEditBtn(paragraph, "paragraph", timestamp);
  addEditBtn(abSummaryEl, "absum", timestamp);
  addEditBtn(exSummaryEl, "exsum", timestamp);
}

function addEditBtn(area, type, timestamp) {
  let editBtn1 = document.createElement("span");
  editBtn1.className = "edit-btn";
  editBtn1.id = "edit-" + type + "-" + timestamp;
  editBtn1.onclick = function () { editContent(type, timestamp); rc.addUserLog(Date.now(), 'Start edit message: ' + type + '-' + timestamp + '\n'); };
  let pen1 = document.createElement("i");
  pen1.className = "fas fa-pen";
  editBtn1.append(pen1);
  area.append(editBtn1);
}

function onUpdateSummary(type, content, timestamp) {
  console.log("onUpdateSummary");

  let messageBox = document.getElementById(timestamp);
  let summaryEl = null;
  let msg = 'New summary contents: ' + timestamp + '\n';
  if (type == "absum") {
    summaryEl = messageBox.childNodes[2].childNodes[0];
    msg = msg + '                [AbSummary] ' + summaryArr[0] + '\n';
  }
  else {
    summaryEl = messageBox.childNodes[3].childNodes[0];
    msg = msg + '                [ExSumamry] ' + summaryArr[1] + '\n';
  }

  summaryEl.textContent = content;
  rc.addUserLog(Date.now(), msg);
  addEditBtn(summaryEl, type, timestamp);
}

// Event listener on individual transcript arrival.
function onTranscript(transcript, name, timestamp) {
  let transCheck = document.getElementById("minutes-transcript").checked;
  let abCheck = document.getElementById("minutes-ab").checked;
  let exCheck = document.getElementById("minutes-ex").checked;

  let messageBox = getMessageBox(timestamp);
  if (!messageBox) {
    messageBox = createMessageBox(name, timestamp);
  }

  // Append the new transcript to the old paragraph.
  let paragraph = messageBox.childNodes[1];
  paragraph.textContent += transcript + " ";

  if (!transCheck && !abCheck && !exCheck) {
    displayNo(messageBox);
  }
  else if (!transCheck) {
    displayNo(paragraph);
  }
}

// Event listener on summary arrival.
function onSummary(summaryArr, confArr, name, timestamp) {
  let transCheck = document.getElementById("minutes-transcript").checked;
  let abCheck = document.getElementById("minutes-ab").checked;
  let exCheck = document.getElementById("minutes-ex").checked;

  let messageBox = getMessageBox(timestamp);
  if (!messageBox) {
    messageBox = createMessageBox(name, timestamp);
  }

  let abSummaryBox = messageBox.childNodes[2];
  let exSummaryBox = messageBox.childNodes[3];
  let keywordBox = messageBox.childNodes[4];

  let abSummaryEl = abSummaryBox.childNodes[0];
  abSummaryEl.textContent = "[Abstractive]\n" + summaryArr[0];

  let exSummaryEl = exSummaryBox.childNodes[0];
  exSummaryEl.textContent = "[Extractive]\n" + summaryArr[1];

  let keywordEl = keywordBox.childNodes[0];
  keywordList = "";
  for (keyword of summaryArr.slice(2)) {
    keywordList += "#" + keyword + " ";
  }
  keywordEl.textContent = "[Keywords]\n" + keywordList;


  // If confidence === -1, the summary result is only the paragraph itself.
  // Do not put confidence element as a sign of "this is not a summary"
  if (confArr[0] !== -1) {
    let confidenceElem = confidenceElement(confArr[0]);
    abSummaryEl.append(confidenceElem);
  }
  if (confArr[1] !== -1) {
    let confidenceElem = confidenceElement(confArr[1]);
    exSummaryEl.append(confidenceElem);
  }

  if (!transCheck && !abCheck && !exCheck) {
    displayNo(messageBox);
  }
  else if (!transCheck) {
    displayBox(abCheck, abSummaryBox, displayBig);
    displayBox(exCheck, exSummaryBox, displayBig);
  }
  else {
    if (!abCheck) {
      displayNo(abSummaryBox);
    }
    if (!exCheck) {
      displayNo(exSummaryBox);
    }
  }

  // Add edit button in order to allow user change contents (paragraph, absummary, exsummary)
  let paragraph = messageBox.childNodes[1];
  addEditBtn(paragraph, "paragraph", timestamp);

  addEditBtn(abSummaryEl, "absum", timestamp);

  addEditBtn(exSummaryEl, "exsum", timestamp);
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
  let messageBox = document.getElementById(timestamp);
  let oldtxt = null;
  switch (type) {
    case "paragraph":
      let paragraph = messageBox.childNodes[1];

      paragraph.contentEditable = "true";

      // change icon
      console.log(paragraph);
      console.log(paragraph.childNodes[1]);

      toEditingBg(paragraph)
      toEditingIcon(paragraph.childNodes[1])

      oldtxt = paragraph.textContent;

      paragraph.childNodes[1].onclick = function () { finishEditContent("paragraph", oldtxt, timestamp); };

      break;
    case "absum":
      let abSummary = messageBox.childNodes[2].childNodes[0];

      abSummary.contentEditable = "true";

      // change icon
      console.log(abSummary);
      console.log(abSummary.lastChild);

      toEditingBg(abSummary)
      toEditingIcon(abSummary.lastChild)

      oldtxt = abSummary.textContent;

      abSummary.lastChild.onclick = function () { finishEditContent("absum", oldtxt, timestamp); };
      break;
    case "exsum":
      let exSummary = messageBox.childNodes[3].childNodes[0];

      exSummary.contentEditable = "true";

      // change icon
      console.log(exSummary);
      console.log(exSummary.lastChild);

      toEditingBg(exSummary)
      toEditingIcon(exSummary.lastChild)

      oldtxt = exSummary.textContent;

      exSummary.lastChild.onclick = function () { finishEditContent("exsum", oldtxt, timestamp); };
      break;
  }
}

function finishEditContent(type, oldtxt, timestamp) {
  let messageBox = document.getElementById(timestamp);
  console.log(oldtxt)

  switch (type) {
    case "paragraph":
      let paragraph = messageBox.childNodes[1];
      console.log(paragraph.textContent);
      toEditableBg(paragraph);
      paragraph.contentEditable = "false";

      if (oldtxt.valueOf() != paragraph.textContent.valueOf()) {
        // update paragraph and summary on all users
        rc.updateParagraph(paragraph.textContent, timestamp, messageBox.childNodes[0].childNodes[0].textContent);
        rc.addUserLog(Date.now(), 'Finish edit message by '+messageBox.childNodes[0].childNodes[0].textContent+': ' + type + '-' + timestamp + '\n');
      }
      else {
        // change icon
        console.log(paragraph);
        console.log(paragraph.childNodes[1]);

        toEditableIcon(paragraph.childNodes[1])

        paragraph.childNodes[1].onclick = function () { editContent(type, timestamp); };
        rc.addUserLog(Date.now(), 'Cancel edit message: ' + type + '-' + timestamp + '\n');
      }
      break;
    default:
      let summary = null;
      if (type == "absum") {
        summary = messageBox.childNodes[2].childNodes[0];
      }
      else {
        summary = messageBox.childNodes[3].childNodes[0];
      }

      toEditableBg(summary);
      summary.contentEditable = "false";

      if (oldtxt != summary.textContent) {
        rc.updateSummary("absum", summary.textContent, timestamp)
        rc.addUserLog(Date.now(), 'Finish edit message: ' + type + '-' + timestamp + '\n');
      }
      else {
        toEditableIcon(summary.lastChild)
        summary.lastChild.onclick = function () { editContent(type, timestamp); };
        rc.addUserLog(Date.now(), 'Cancel edit message: ' + type + '-' + timestamp + '\n');
      }
      break;
  }
}

function displayUnitOfBox() {
  let searchword = document.getElementById("search-word").value

  let transCheck = document.getElementById("minutes-transcript").checked;
  let abCheck = document.getElementById("minutes-ab").checked;
  let exCheck = document.getElementById("minutes-ex").checked;

  let messageBoxes = document.getElementsByClassName("message-box");
  let paragraphs = document.getElementsByClassName("paragraph");
  let abSummaryBoxes = document.getElementsByClassName("ab-summary-box");
  let exSummaryBoxes = document.getElementsByClassName("ex-summary-box");

  for (var i = 0; i < messageBoxes.length; i++) { // access each i-th index of boxes at the same time
    let isfiltered = paragraphs[i].textContent.includes(searchword);

    let messageBox = messageBoxes[i];
    let paragraph = paragraphs[i];
    let abSummaryBox = abSummaryBoxes[i];
    let exSummaryBox = exSummaryBoxes[i];

    if (!transCheck && !abCheck && !exCheck) {
      displayBox(false && isfiltered, messageBox, displayNo);
    }
    else {
      displayBox(true && isfiltered, messageBox, displayYes);
      displayBox(transCheck && isfiltered, paragraph, displayYes);

      if (transCheck) {
        displayBox(abCheck && isfiltered, abSummaryBox, displaySm);
        displayBox(exCheck && isfiltered, exSummaryBox, displaySm);
      }
      else {
        displayBox(abCheck && isfiltered, abSummaryBox, displayBig);
        displayBox(exCheck && isfiltered, exSummaryBox, displayBig);
      }
    }
  }
}


//////////////////////////////////////////////
/************* Helper functions *************/

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
    messageBox.style.background = "rgba(40, 70, 167, 0.219)";
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
  messageBox.append(title);

  // messageBox.childNodes[1]: includes the (unsummarized) paragraph
  let paragraph = document.createElement("p");
  paragraph.className = "paragraph";
  paragraph.style.fontSize = "medium";
  messageBox.append(paragraph);

  // messageBox.childNodes[2]: includes the abstraxtive summary and confidence level
  let abSummaryBox = document.createElement("div");
  let abSummary = document.createElement("p");

  // messageBox.childNodes[3]: includes the abstraxtive summary and confidence level
  let exSummaryBox = document.createElement("div");
  let exSummary = document.createElement("p");

  // messageBox.childNodes[4]: includes the keywords
  let keywordBox = document.createElement("div");
  let keywords = document.createElement("p")

  abSummaryBox.className = "ab-summary-box";
  abSummaryBox.style.fontSize = "smaller";
  abSummaryBox.style.marginLeft = "1em";
  abSummaryBox.append(abSummary);
  messageBox.append(abSummaryBox);

  exSummaryBox.className = "ex-summary-box";
  exSummaryBox.style.fontSize = "smaller";
  exSummaryBox.style.marginLeft = "1em";
  exSummaryBox.append(exSummary);
  messageBox.append(exSummaryBox);

  keywordBox.className = "keyword-box";
  keywordBox.style.fontSize = "smaller";
  keywordBox.style.marginLeft = "1em";
  keywordBox.append(keywords);
  messageBox.append(keywordBox);

  // Finally append the box to 'messages' area
  messages.appendChild(messageBox);

  return messageBox;
}

// Gets an existing message box that matches given timestamp.
function getMessageBox(timestamp) {
  return document.getElementById(timestamp.toString());
}

// Formats time from a timestamp in hh:mm:ss AM/PM format.
function formatTime(timestamp) {
  let date = new Date(timestamp);

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
