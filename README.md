# AI Moderator

Example website for video conferencing using mediasoup as SFU (selective forwarding unit) and featuring AI Moderator.
AI Moderator features transcription of conferences, summarization of the transcripts, stance detection, and etc.
This project demonstrates how AI Moderator can work on a simple video conferencing environment.

The video conferencing feature is built over [Mediasoup video conferencing](https://https://github.com/Dirvann/mediasoup-sfu-webrtc-video-rooms). 

# Running the code

### Summary server

1. Install requirements in `summarizer/requirements.txt` (change directory to `summarizer/` then run `pip3 install -r requirements.txt`. You may want to use `venv`). It takes minutes to complete.
2. Run `npm run summarizer` in the project root. It also takes some time to start listening. It will listen for summary request from **Moderator server**.

### Moderator server

1. (required) Place a Google Cloud project's API key file in the parent(`../`) directory of the project root.
2. (required) Change name of `moderator/config.example.js` into `config.js`, then edit the file according to your project ID and key file name. For more information about issueing Google Cloud API key, [visit here](https://cloud.google.com/speech-to-text/docs/quickstart-client-libraries?hl=ko)
3. run `npm install`
4. run `npm run moderator`. It will start listening for transcription requests from clients accessing through **Media server**.

### Media Server

1. run `npm install` (unless you did already)
2. run `npm run media-server`, then finally open your browser at `https://localhost:8000` or your own defined url/port in `media-server/config.js` file.
3. A page is rendered requiring you to enter names for a room and your own. Enter them and click `CREATE` button.
4. `Invite` others.

(optional) Edit the `media-server/config.js` file according to your needs and replace the `ssl/key.pem ssl/cert.pem` certificates with your own.

# Deployment

To enable video conferencing from other than `localhost`, replace `announcedIP` in `media-server/config.js` with your public ip address of the server and modify the port you want to serve it in.

Add firewall rules of the port of the webpage (default 8000) and the RTC connections (default UDP 10,000-10100) for the machine.

### Notes

Best to run the project on a linux system as the mediasoup installation could have issues by installing on windows. At least **Media server** should run on a linux system. If you have a windows system consider installing WSL to be able to run it.

[installing wsl on windows 10](https://docs.microsoft.com/en-us/windows/wsl/install-win10)

You may want to run the three servers in separate machines. Or at least it is better to run the summary server on another high-performance machine with GPU. If so, edit `moderator/config.js` for the summary server host. The three servers are able to run on separate machines if you edit `config.js` file properly.

Still, it is better to run **summary server first** because it takes long time to start listening.
