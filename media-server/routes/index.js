// index.js
// Defines the route for the root("/") path.

const express = require("express");
const router = express.Router();

// GET home page. Redirect to "/room"
router.get("/", (req, res) => {
  res.redirect("/room");
});

module.exports = router;
