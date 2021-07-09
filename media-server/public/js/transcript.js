// transcript.js
// Defines event handlers for transcripts from moderator server.
// Includes UI control on transcription and summary data arrival.

const messages = document.getElementById("messages");

moderatorSocket.on("transcript", onTranscript);
moderatorSocket.on("summary", onSummary);

// Event listener on individual transcript arrival.
function onTranscript(transcript, name, timestamp) {
  let messageBox = getMessageBox(timestamp);
  if (!messageBox) {
    messageBox = createMessageBox(name, timestamp);
  }

  // Append the new transcript to the old paragraph.
  let paragraph = messageBox.childNodes[1];
  paragraph.textContent += transcript + " ";

  // Scroll down the messages area.
  messages.scrollTop = messages.scrollHeight;
}

// Event listener on summary arrival.
function onSummary(summaryArr, confArr, name, timestamp) {
  let messageBox = getMessageBox(timestamp);
  if (!messageBox) {
    messageBox = createMessageBox(name, timestamp);
  }

  let summaryBox = messageBox.childNodes[2];
  let exSummaryBox = messageBox.childNodes[3];

  let summaryEl = summaryBox.childNodes[0];
  summaryEl.textContent = summaryArr[0];

  let exSummaryEl = exSummaryBox.childNodes[0];
  exSummaryEl.textContent = summaryArr[1];

  // If confidence === -1, the summary result is only the paragraph itself.
  // Do not put confidence element as a sign of "this is not a summary"
  if (confArr[0] !== -1) {
    let confidenceElem = confidenceElement(confArr[0]);
    summaryEl.append(confidenceElem);
  }
  if (confArr[1] !== -1) {
    let confidenceElem = confidenceElement(confArr[1]);
    exSummaryEl.append(confidenceElem);
  }


  // Scroll down the messages area.
  messages.scrollTop = messages.scrollHeight;
}

function displayScript(choice) {
  let abCheck = document.getElementById("minutes-ab");
  let exCheck = document.getElementById("minutes-ex");
  let paragraphs = document.getElementsByClassName("paragraph");
  let summaryBoxes = document.getElementsByClassName("summary-box");
  let exSummaryBoxes = document.getElementsByClassName("ex-summary-box");
  if (choice.checked) {
    // Show transcripts only: display paragraphs
    for (let paragraph of paragraphs) {
      paragraph.style.display = "";
    }
    if (abCheck.checked) {
      // Reduce size of summary boxes and add left margin
      for (let summaryBox of summaryBoxes) {
        summaryBox.style.marginLeft = "1em";
        summaryBox.style.fontSize = "smaller";
        summaryBox.style.display = "";
      }
    }
    if (exCheck.checked) {
      // Reduce size of summary boxes and add left margin
      for (let summaryBox of exSummaryBoxes) {
        summaryBox.style.marginLeft = "1em";
        summaryBox.style.fontSize = "smaller";
        summaryBox.style.display = "";
      }
    }
  }
  else {
    if (abCheck.checked) {
      // Larger the summary boxes and remove left margin
      for (let summaryBox of summaryBoxes) {
        summaryBox.style.marginLeft = "";
        summaryBox.style.fontSize = "medium";
        summaryBox.style.display = "";
      }
    }
    if (exCheck.checked) {
      // Larger the summary boxes and remove left margin
      for (let summaryBox of exSummaryBoxes) {
        summaryBox.style.marginLeft = "";
        summaryBox.style.fontSize = "medium";
        summaryBox.style.display = "";
      }
    }
    // Show summaries only: hide paragraphs
    for (let paragraph of paragraphs) {
      paragraph.style.display = "none";
    }
  }
}

function displayAbSummary(choice) {
  let transCheck = document.getElementById("minutes-transcript");
  // let exCheck = document.getElementById("minutes-transcript");
  let summaryBoxes = document.getElementsByClassName("summary-box");
  console.log(transCheck);
  if (!transCheck.checked && choice.checked) {
    // Larger the summary boxes and remove left margin
    for (let summaryBox of summaryBoxes) {
      summaryBox.style.marginLeft = "";
      summaryBox.style.fontSize = "medium";
      summaryBox.style.display = "";
    }
  }
  else if (choice.checked) {
    // Reduce size of summary boxes and add left margin
    for (let summaryBox of summaryBoxes) {
      summaryBox.style.marginLeft = "1em";
      summaryBox.style.fontSize = "smaller";
      summaryBox.style.display = "";
    }
  }
  else {
    // Hide summary boxes.
    for (let summaryBox of summaryBoxes) {
      summaryBox.style.display = "none";
    }
  }
}

function displayExSummary(choice) {
  let transCheck = document.getElementById("minutes-transcript");
  // let abCheck = document.getElementById("minutes-ab");
  let exSummaryBoxes = document.getElementsByClassName("ex-summary-box");
  // let abSummaryBoxes = document.getElementsByClassName("summary-box");
  // let paragraphs = document.getElementsByClassName("paragraph");
  console.log(transCheck);
  if (!transCheck.checked && choice.checked) {
    // Larger the summary boxes and remove left margin
    for (let summaryBox of exSummaryBoxes) {
      summaryBox.style.marginLeft = "";
      summaryBox.style.fontSize = "medium";
      summaryBox.style.display = "";
    }
  }
  else if (choice.checked) {
    // Reduce size of summary boxes and add left margin
    for (let summaryBox of exSummaryBoxes) {
      summaryBox.style.marginLeft = "1em";
      summaryBox.style.fontSize = "smaller";
      summaryBox.style.display = "";
    }
  }
  else {
    // Hide summary boxes.
    for (let summaryBox of exSummaryBoxes) {
      summaryBox.style.display = "none";
    }
  }
}

// Hide or display transcripts or summaries according to radio button choice
// function displayChoice(choice) {
//   let paragraphs = document.getElementsByClassName("paragraph");
//   let summaryBoxes = document.getElementsByClassName("summary-box");

//   switch (choice.value) {
//     case "both":
//       // Show both: display paragraphs
//       for (let paragraph of paragraphs) {
//         paragraph.style.display = "";
//       }

//       // Reduce size of summary boxes and add left margin
//       for (let summaryBox of summaryBoxes) {
//         summaryBox.style.marginLeft = "1em";
//         summaryBox.style.fontSize = "smaller";
//         summaryBox.style.display = "";
//       }

//       break;
//     case "transcript":
//       // Show transcripts only: display paragraphs
//       for (let paragraph of paragraphs) {
//         paragraph.style.display = "";
//       }

//       // Hide summary boxes.
//       for (let summaryBox of summaryBoxes) {
//         summaryBox.style.display = "none";
//       }
//       break;
//     case "summary":
//       // Show summaries only: hide paragraphs
//       for (let paragraph of paragraphs) {
//         paragraph.style.display = "none";
//       }

//       // Larger the summary boxes and remove left margin
//       for (let summaryBox of summaryBoxes) {
//         summaryBox.style.marginLeft = "";
//         summaryBox.style.fontSize = "medium";
//         summaryBox.style.display = "";
//       }
//       break;
//   }
// }

// Helper functions

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

  // messageBox.childNodes[2]: includes the summary and confidence level
  let summaryBox = document.createElement("div");
  let summary = document.createElement("p");
  let exSummaryBox = document.createElement("div");
  let exSummary = document.createElement("p");

  summaryBox.className = "summary-box";
  summaryBox.style.fontSize = "smaller";
  summaryBox.style.marginLeft = "1em";
  summaryBox.append(summary);
  messageBox.append(summaryBox);

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
