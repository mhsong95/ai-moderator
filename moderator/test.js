const https = require("https");
const axios = require("axios");

axios
  .post(
    "https://localhost:3017/",
    {
      room_id: "Room 495",
      room_secret: "Cat vs dog",
    },
    {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    }
  )
  .then((res) => {
    console.log(res.status);
  });
