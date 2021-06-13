# AI Moderator

Example website for video conferencing using mediasoup as SFU (selective forwarding unit) and featuring AI Moderator.
AI Moderator features transcription of conferences, summarization of the transcripts, stance detection, and etc.
This project demonstrates how AI Moderator can work on a simple video conferencing environment.

The video conferencing feature is built over [Mediasoup video conferencing](https://https://github.com/Dirvann/mediasoup-sfu-webrtc-video-rooms). Any other features (AI Moderator) are original work of the author.

# Running the code

- run `npm install` then `npm start` to run the application. Then open your browser at `https://localhost:3016` or your own defined port/url in the config file.
- (optional) edit the `src/config.js` file according to your needs and replace the `ssl/key.pem ssl/cert.pem` certificates with your own.

# Deployment

- in `config.js` replace the `announcedIP` with your public ip address of the server and modify the port you want to serve it in.
- add firewall rules of the port of the webpage (default 3016) and the rtc connections (default udp 10000-10100) for the machine.


notes : Best to run the project on a linux system as the mediasoup installation could have issues by installing on windows. If you have a windows system consider installing WSL to be able to run it. 

[installing wsl on windows 10](https://docs.microsoft.com/en-us/windows/wsl/install-win10)
