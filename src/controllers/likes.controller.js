const likesService = require("../services/likes.service");

async function list(req, res) {
  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) {
    return res.status(404).json({ error: "Post not found" });
  }

  try {
    const users = await likesService.getLikesForPost(postId);
    if (!users) {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function create(req, res) {
  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) {
    return res.status(404).json({ error: "Post not found" });
  }

  const { userId } = req.body || {};
  if (userId === undefined || userId === null || userId === "") {
    return res.status(400).json({ error: "userId is required" });
  }

  const parsedUserId = parseInt(userId, 10);
  if (isNaN(parsedUserId)) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const result = await likesService.addLike(postId, parsedUserId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(201).json(result.like);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function remove(req, res) {
  const postId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);

  if (isNaN(postId) || isNaN(userId)) {
    return res.status(404).json({ error: "Like not found" });
  }

  try {
    const result = await likesService.removeLike(postId, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  list,
  create,
  remove,
};
