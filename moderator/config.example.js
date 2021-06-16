module.exports = {
    // for moderator server
    listenIp: '0.0.0.0',
    listenPort: 8001,
    sslCrt: '../ssl/cert.pem',
    sslKey: '../ssl/key.pem',
    // media server host
    mediaServerHost: 'https://localhost:8000',
    // summary server host
    summaryHost: 'http://localhost:5050',

    // Google Cloud API project ID & key file name.
    projectId: 'your-own-project-id',
    keyFilename: '../your-own-keyfile-name.json',  // this path is relative to the execution directory. 
}