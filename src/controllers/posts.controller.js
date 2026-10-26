const postsService = require("../services/posts.service");
const { parsePagination, formatPaginatedResponse } = require("../utils/pagination");

async function create(req, res) {
  const { imageUrl, authorId, caption, location } = req.body || {};

  if (!imageUrl || authorId === undefined || authorId === null || authorId === "") {
    return res.status(400).json({ error: "imageUrl and authorId are required" });
  }

  const parsedAuthorId = parseInt(authorId, 10);
  if (isNaN(parsedAuthorId)) {
    return res.status(400).json({ error: "imageUrl and authorId are required" });
  }

  try {
    const post = await postsService.createPost({
      imageUrl,
      authorId: parsedAuthorId,
      caption,
      location,
    });
    return res.status(201).json(post);
  } catch (error) {
    if (error.status === 404 || error.code === "P2003") {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function list(req, res) {
  const pagination = parsePagination(req.query);
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  const { sortBy = "createdAt", order = "desc", location, search, from, to } = req.query;

  const allowedSortBy = ["createdAt", "updatedAt", "likes"];
  if (req.query.sortBy && !allowedSortBy.includes(sortBy)) {
    return res.status(400).json({ error: "sortBy must be one of: createdAt, updatedAt, likes" });
  }

  if (req.query.order && !["asc", "desc"].includes(order)) {
    return res.status(400).json({ error: "order must be asc or desc" });
  }

  if (from !== undefined && (from.trim() === "" || isNaN(Date.parse(from)))) {
    return res.status(400).json({ error: "from and to must be valid dates" });
  }

  if (to !== undefined && (to.trim() === "" || isNaN(Date.parse(to)))) {
    return res.status(400).json({ error: "from and to must be valid dates" });
  }

  try {
    const { posts, total } = await postsService.listPosts({
      skip: pagination.skip,
      take: pagination.take,
      sortBy,
      order,
      location,
      search,
      from,
      to,
    });

    return res.status(200).json(
      formatPaginatedResponse(posts, pagination.page, pagination.limit, total)
    );
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getOne(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(404).json({ error: "Post not found" });
  }

  try {
    const post = await postsService.getPostById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(200).json(post);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function update(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(404).json({ error: "Post not found" });
  }

  try {
    const post = await postsService.updatePost(id, req.body || {});
    return res.status(200).json(post);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function remove(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(404).json({ error: "Post not found" });
  }

  try {
    await postsService.deletePost(id);
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  create,
  list,
  getOne,
  update,
  remove,
};
