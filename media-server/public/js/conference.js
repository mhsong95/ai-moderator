if (location.href.substr(0, 5) !== "https")
  location.href = "https" + location.href.substr(4, location.href.length - 4);

const socket = io();

socket.request = function request(type, data = {}) {
  return new Promise((resolve, reject) => {
    socket.emit(type, data, (data) => {
      if (data.error) {
        reject(data.error);
      } else {
        resolve(data);
      }
    });
  });
};

const localMedia = document.getElementById("local-media");
const remoteMedia = document.getElementById("remote-media");

socket.on("connect", () => {
  localMedia.id = socket.id;
});
const rc = new RoomClient(
  localMedia,
  remoteMedia,
  window.mediasoupClient,
  socket,
  room_id,
  user_name,
  roomOpen
);
addListeners();

/*
function joinRoom(name, room_id) {
  if (rc && rc.isOpen()) {
    console.log('already connected to a room')
  } else {
    rc = new RoomClient(localMedia, remoteVideos, remoteAudios, window.mediasoupClient, socket, room_id, name, roomOpen)

    addListeners()
  }

}
*/

const startAudioButton = document.getElementById("start-audio-button");
const stopAudioButton = document.getElementById("stop-audio-button");
const startVideoButton = document.getElementById("start-video-button");
const stopVideoButton = document.getElementById("stop-video-button");

function roomOpen() {
  // login.className = 'hidden'
  reveal(startAudioButton);
  hide(stopAudioButton);
  reveal(startVideoButton);
  hide(stopVideoButton);
  /*
  reveal(startScreenButton)
  hide(stopScreenButton)
  reveal(exitButton)
  control.className = ''
  reveal(videoMedia)
  */
}

function hide(elem) {
  elem.style.display = "none";
}

function reveal(elem) {
  elem.style.display = "";
}

function addListeners() {
  rc.on(RoomClient.EVENTS.startScreen, () => {
    hide(startScreenButton)
    reveal(stopScreenButton)
    stopScreenButton.disabled = false;
  })
  rc.on(RoomClient.EVENTS.stopScreen, () => {
    hide(stopScreenButton)
    reveal(startScreenButton)
    startScreenButton.disabled = false;

  })

  rc.on(RoomClient.EVENTS.stopAudio, () => {
    hide(stopAudioButton);
    reveal(startAudioButton);
    startAudioButton.disabled = false;
  });
  rc.on(RoomClient.EVENTS.startAudio, () => {
    hide(startAudioButton);
    reveal(stopAudioButton);
    stopAudioButton.disabled = false;
  });

  rc.on(RoomClient.EVENTS.startVideo, () => {
    hide(startVideoButton);
    reveal(stopVideoButton);
    stopVideoButton.disabled = false;
  });
  rc.on(RoomClient.EVENTS.stopVideo, () => {
    hide(stopVideoButton);
    reveal(startVideoButton);
    startVideoButton.disabled = false;
  });

  /*
  rc.on(RoomClient.EVENTS.exitRoom, () => {
    hide(control)
    reveal(login)
    hide(videoMedia)
  })
  */
}

function copyJoinLink() {
  let textarea = document.createElement("textarea");
  textarea.value = `${location.origin}/room/join/${room_id}`;

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, 9999);

  document.execCommand("copy");
  document.body.removeChild(textarea);

  rc.addUserLog(Date.now(), "Invite button clicked!\n");

  alert("Link copied to clipboard");
}

// Load mediaDevice options
navigator.mediaDevices.enumerateDevices().then((devices) =>
  devices.forEach((device) => {
    let el = null;
    if ("audioinput" === device.kind) {
      el = document.getElementById("audio-select");
    } else if ("videoinput" === device.kind) {
      el = document.getElementById("video-select");
    }
    if (!el) return;

    let option = document.createElement("option");
    option.value = device.deviceId;
    option.innerText = device.label;
    el.appendChild(option);
  })
);
