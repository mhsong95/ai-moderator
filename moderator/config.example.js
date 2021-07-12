module.exports = {
    // for moderator server
    listenIp: '0.0.0.0',
    listenPort: 8001,
    sslCrt: '../ssl/cert.pem',
    sslKey: '../ssl/key.pem',
    // media server host
    mediaServerHost: 'https://143.248.136.68:8080',//'https://143.248.136.68:8000',//
    // summary server host
    summaryHost: 'http://143.248.136.68:4040',
    // Google Cloud API project ID & key file name.
    projectId: "ai-moderator-1623916044625",
    keyFilename: "../ai-moderator-98cc2cb04591.json", // this path is relative to the execution directory.
    // Kakao API
    rest_api_key: "d6ef37cd46973a9f1ebfcd2fc07d8636",
    // MS Azure STT subscriptionKey & serviceRegion
    subKey: "d265d762a40f4cbf87f5d95d9008be41",
    servReg: "eastus",
}