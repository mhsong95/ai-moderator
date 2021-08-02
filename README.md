# AI Moderator

Example website for video conferencing using mediasoup as SFU (selective forwarding unit) and featuring AI Moderator.
AI Moderator features transcription of conferences, summarization of the transcripts, stance detection, and etc.
This project demonstrates how AI Moderator can work on a simple video conferencing environment.

The video conferencing feature is built over [Mediasoup video conferencing](https://https://github.com/Dirvann/mediasoup-sfu-webrtc-video-rooms).

# Running the code

### Summary server

1. Install requirements in `summarizer/requirements.txt` (change directory to `summarizer/` then run `pip3 install -r requirements.txt`. You may want to use `venv`). It takes minutes to complete.
2. Install Hangul analyzer `khaiii`.

- `$ git clone https://github.com/kakao/khaiii.git`
- `$ cd khaiii`
- `$ mkdir build`
- `$ cd build`
- `$ cmake ..` (This will takes minutes.)
- `$ make all`
- `$ make resource`
- `$ ctest` (Check if khaiii works properly.)
- `$ make package_python`
- `$ cd package_python`
- `$ pip install .` (Done.)

3. Check if there is `summarizer/wav` directory. If not, make `wav` directory.

4. Run `echo [PORT] | npm run summarizer` in the `summarizer` directory. It also takes some time to start listening. It will listen for summary request from **Moderator server**.

### Moderator server

1. (required) Change name of `moderator/config.example.js` into `config.js`, then add Microsoft Azure STT's subscription key(subKey) and service region(servReg), PORT informations in the `moderator/config.js` file.
2. run `npm install` in `moderator` directory.
3. Check if there is `moderator/webm` directory. If not, make `webm` directory.
4. run `npm run moderator` in `moderator` directory. It will start listening for transcription requests from clients accessing through **Media server**.

### Media Server

1. make `logs` folder in `media-server` directory.
2. run `npm install` in `media-server` directory.
3. run `npm run media-server` in `media-server` directory, then finally open your browser at `https://localhost:8000` or your own defined url/port in `media-server/config.js` file.
4. A page is rendered requiring you to enter names for a room and your own. Enter them and click `CREATE` button.
5. `Invite` others.

(optional) Edit the `media-server/config.js` file according to your needs and replace the `ssl/key.pem ssl/cert.pem` certificates with your own.

# Deployment

To enable video conferencing from other than `localhost`, replace `announcedIP` in `media-server/config.js` with your public ip address of the server and modify the port you want to serve it in.

Add firewall rules of the port of the webpage (default 8000) and the RTC connections (default UDP 10,000-10100) for the machine.

### Notes

Best to run the project on a linux system as the mediasoup installation could have issues by installing on windows. At least **Media server** should run on a linux system. If you have a windows system consider installing WSL to be able to run it.

[installing wsl on windows 10](https://docs.microsoft.com/en-us/windows/wsl/install-win10)

You may want to run the three servers in separate machines. Or at least it is better to run the summary server on another high-performance machine with GPU. If so, edit `moderator/config.js` for the summary server host. The three servers are able to run on separate machines if you edit `config.js` file properly.

Still, it is better to run **summary server first** because it takes long time to start listening.
