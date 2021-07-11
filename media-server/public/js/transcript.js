// transcript.js
// Defines event handlers for transcripts from moderator server.
// Includes UI control on transcription and summary data arrival.

const messages = document.getElementById("messages");

moderatorSocket.on("transcript", onTranscript);
moderatorSocket.on("summary", onSummary);

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

  // Scroll down the messages area.
  messages.scrollTop = messages.scrollHeight;

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

  let abSummaryEl = abSummaryBox.childNodes[0];
  abSummaryEl.textContent = "[Abstractive]\n" + summaryArr[0];

  let exSummaryEl = exSummaryBox.childNodes[0];
  exSummaryEl.textContent = "[Extractive]\n" + summaryArr[1];

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

  // Scroll down the messages area.
  messages.scrollTop = messages.scrollHeight;
}

function displayScript() {
  let transCheck = document.getElementById("minutes-transcript").checked;
  let abCheck = document.getElementById("minutes-ab").checked;
  let exCheck = document.getElementById("minutes-ex").checked;

  let messageBoxes = document.getElementsByClassName("message-box");
  let paragraphs = document.getElementsByClassName("paragraph");
  let abSummaryBoxes = document.getElementsByClassName("ab-summary-box");
  let exSummaryBoxes = document.getElementsByClassName("ex-summary-box");

  if (!transCheck && !abCheck && !exCheck) {
    // Hide message layout
    displayBoxes(false, messageBoxes, displayNo);
  }
  else {
    // Show message layout
    displayBoxes(true, messageBoxes, displayYes);

    // If transCheck==true, show paragraphs
    displayBoxes(transCheck, paragraphs, displayYes);

    if (transCheck) {
      // If Abstractive Summary checked, reduce size of summary boxes and add left margin
      // otherwise, hide exSummaryBoxes.
      displayBoxes(abCheck, abSummaryBoxes, displaySm);

      // If Extractive Summary checked, reduce size of summary boxes and add left margin
      // otherwise, hide exSummaryBoxes.
      displayBoxes(exCheck, exSummaryBoxes, displaySm);
    }
    else {
      // If Abstractive Summary checked, larger the summary boxes and remove left margin
      // otherwise, hide abSummaryBoxes.
      displayBoxes(abCheck, abSummaryBoxes, displayBig);

      // If Extractive Summary checked, larger the summary boxes and remove left margin
      // otherwise, hide exSummaryBoxes.
      displayBoxes(exCheck, exSummaryBoxes, displayBig);
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
