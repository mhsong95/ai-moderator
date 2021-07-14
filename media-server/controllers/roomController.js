// roomController.js
// Defines behaviors for the "room" routes (routes/room.js).

module.exports = function (io) {
  const { body, validationResult } = require("express-validator");
  const { v4: uuidV4 } = require("uuid");

  const Room = require("../lib/Room");
  const { roomList } = require("../lib/global");
  const { getMediasoupWorker } = require("../lib/Worker");

  const { moderatorHostname, moderatorPort } = require("../config");

  return {
    room_create_get: function (req, res, next) {
      res.render("room-entry", {
        title: "Create New Room",
        room_name: "",
        room_name_attr: "required",
        user_name: "",
        button_label: "CREATE",
        error: null,
      });
    },

    room_create_post: [
      // Validate user inputs
      body("room_name")
        .trim()
        .escape()
        .isLength({ min: 1 })
        .withMessage("Enter the room name")
        .isLength({ max: 50 })
        .withMessage("Room name must be shorter than 50 characters"),
      body("user_name")
        .trim()
        .escape()
        .isLength({ min: 1 })
        .withMessage("Enter your name")
        .isLength({ max: 30 })
        .withMessage("Enter a name shorter than 30 characters"),

      async function (req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          // Re-render the page when validation fails.
          res.render("room-entry", {
            title: "Create New Room",
            room_name: req.body.room_name,
            room_name_attr: "required",
            user_name: req.body.user_name,
            button_label: "CREATE",
            error: errors.array()[0],
          });
          return;
        }

        const { room_name, user_name } = req.body;
        const room_id = uuidV4(); // Generate a unique room ID.

        // Create a Room instance with given ID, name, worker and io instances.
        let worker = await getMediasoupWorker();
        let newRoom = new Room(room_id, room_name, worker, io);
        roomList.set(room_id, newRoom);

        // Set timeout that deletes the room if no one enters for 30 sec.
        newRoom.roomExpireTimeout = setTimeout(() => {
          if (newRoom.getPeers().size === 0) {
            roomList.delete(room_id);
            console.log(`DESTROYED: ${room_id} after timeout`);
          }
          newRoom.roomExpireTimeout = null;
        }, 30 * 1000);

        // Store the user name temporarily in session.
        if (!req.session.nameMap) {
          req.session.nameMap = {};
        }
        req.session.nameMap[room_id] = user_name;

        console.log(`Created Room: ${room_name}(${room_id}) by ${user_name}`);

        // Redirect to the room page.
        res.render("redirect", {
          msg: `Created Room: ${room_name}`,
          url: `${room_id}`,
        });
      },
    ],

    room_join_get: function (req, res, next) {
      const { room_id } = req.params;
      if (!roomList.has(room_id)) {
        // Redirect to room creation page if room does not exist.
        res.render("redirect", {
          msg: "Room does not exist",
          url: "../create",
        });
        return;
      }

      const room_name = roomList.get(room_id).name;
      res.render("room-entry", {
        title: "Join Room",
        room_name: room_name,
        room_name_attr: "readonly",
        user_name: "",
        button_label: "JOIN",
        error: null,
      });
    },

    room_join_post: [
      body("user_name")
        .trim()
        .escape()
        .isLength({ min: 1 })
        .withMessage("Enter your name")
        .isLength({ max: 30 })
        .withMessage("Enter a name shorter than 30 characters"),

      function (req, res, next) {
        const { room_id } = req.params;
        if (!roomList.has(room_id)) {
          // Redirect to room creation page if room does not exist.
          res.render("redirect", {
            msg: "Room does not exist",
            url: "../create",
          });
          return;
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          // Re-render the page when validation fails.
          res.render("room-entry", {
            title: "Join Room",
            room_name: req.body.room_name,
            room_name_attr: "required",
            user_name: req.body.user_name,
            button_label: "CREATE",
            error: errors.array()[0],
          });
          return;
        }

        // Store the user name temporarily in session.
        const { user_name } = req.body;
        if (!req.session.nameMap) {
          req.session.nameMap = {};
        }
        req.session.nameMap[room_id] = user_name;

        // Redirect to the room page.
        const room_name = roomList.get(room_id).name;
        res.render("redirect", {
          msg: `Joining Room: ${room_name}`,
          url: `../${room_id}`,
        });
      },
    ],

    room_get: function (req, res, next) {
      const { room_id } = req.params;
      if (!roomList.has(room_id)) {
        // Redirect to room creation page if room does not exist.
        res.render("redirect", {
          msg: "Room does not exist",
          url: "create",
        });
        return;
      }

      let user_name = req.session.nameMap[room_id];
      if (!user_name) {
        // If the user access is not normal, redirect to room join page.
        res.render("redirect", {
          msg: "Please enter your name before joining room",
          url: `join/${room_id}`,
        });
        return;
      }

      // Clear the session
      delete req.session.nameMap[room_id];
      if (Object.keys(req.session.nameMap).length === 0) {
        delete req.session.nameMap;
      }

      // Render the room page.
      const room_name = roomList.get(room_id).name;
      res.render("room", {
        room_id: room_id,
        room_name: room_name,
        user_name: user_name,
        moderator_hostname: moderatorHostname || req.hostname,
        moderator_port: moderatorPort, 
      });
    },
  };
};
