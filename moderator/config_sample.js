module.exports = {
  // for moderator server
  listenIp: '0.0.0.0',
  listenPort: 8001,
  sslCrt: '../ssl/cert.pem',
  sslKey: '../ssl/key.pem',
  // media server host
  mediaServerHost: 'https://(ip):(port)',
  // summary server host
  summaryHost: 'http://(ip):',
  // summary server ports
  summaryPorts: ['(port1)', '(port2)'], // add more if you need

  // Google Cloud API project ID & key file name.
  projectId: "",
  keyFilename: "", // this path is relative to the execution directory.

  // Kakao API
  rest_api_key: "",


  // MS Azure STT subscriptionKey & serviceRegion
  subKey: "",
  servReg: "",

  // Naver API 
  accessKey: '',
  secretKey: ''
}
