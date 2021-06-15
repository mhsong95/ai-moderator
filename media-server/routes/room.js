// room.js
// Defines routes for the paths under "/room"

module.exports = function (io) {
  const express = require("express");
  const router = express.Router();

  const room_controller = require("../controllers/roomController")(io);

  router.get("/", (req, res) => {
    res.redirect(req.baseUrl + "/create");
  });

  // GET: room creation page
  router.get("/create", room_controller.room_create_get);

  // POST: room creation page
  router.post("/create", room_controller.room_create_post);

  // GET: room joining page
  router.get("/join/:room_id", room_controller.room_join_get);

  // POST: room joining page
  router.post("/join/:room_id", room_controller.room_join_post);

  // GET: a specific room's page (where the conference is ongoing)
  router.get("/:room_id", room_controller.room_get);

  return router;
};
