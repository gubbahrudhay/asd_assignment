const express = require("express");
const usersController = require("../controllers/users.controller");

const router = express.Router();

router.post("/", usersController.create);
router.get("/", usersController.list);
router.get("/:id", usersController.getOne);
router.patch("/:id", usersController.update);
router.delete("/:id", usersController.remove);
router.get("/:id/posts", usersController.getUserPosts);
router.get("/:id/liked-posts", usersController.getUserLikedPosts);

module.exports = router;
