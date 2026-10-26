const usersService = require("../services/users.service");
const { parsePagination, formatPaginatedResponse } = require("../utils/pagination");

async function create(req, res) {
  const { username, email, fullname, bio } = req.body || {};

  if (!username || !email || !fullname) {
    return res.status(400).json({ error: "username, email and fullname are required" });
  }

  try {
    const user = await usersService.createUser({ username, email, fullname, bio });
    return res.status(201).json(user);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "username or email already taken" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function list(req, res) {
  const pagination = parsePagination(req.query);
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  const { sortBy = "createdAt", order = "desc", isPrivate, search, hasPosts } = req.query;

  const allowedSortBy = ["createdAt", "username", "fullname"];
  if (req.query.sortBy && !allowedSortBy.includes(sortBy)) {
    return res.status(400).json({ error: "sortBy must be one of: createdAt, username, fullname" });
  }

  if (req.query.order && !["asc", "desc"].includes(order)) {
    return res.status(400).json({ error: "order must be asc or desc" });
  }

  let parsedIsPrivate;
  if (isPrivate !== undefined) {
    if (isPrivate !== "true" && isPrivate !== "false") {
      return res.status(400).json({ error: "isPrivate must be true or false" });
    }
    parsedIsPrivate = isPrivate === "true";
  }

  let parsedHasPosts;
  if (hasPosts !== undefined) {
    if (hasPosts !== "true" && hasPosts !== "false") {
      return res.status(400).json({ error: "hasPosts must be true or false" });
    }
    parsedHasPosts = hasPosts === "true";
  }

  try {
    const { users, total } = await usersService.listUsers({
      skip: pagination.skip,
      take: pagination.take,
      sortBy,
      order,
      isPrivate: parsedIsPrivate,
      search,
      hasPosts: parsedHasPosts,
    });

    return res.status(200).json(
      formatPaginatedResponse(users, pagination.page, pagination.limit, total)
    );
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getOne(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(404).json({ error: "User not found" });
  }

  try {
    const user = await usersService.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function update(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(404).json({ error: "User not found" });
  }

  try {
    const user = await usersService.updateUser(id, req.body || {});
    return res.status(200).json(user);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function remove(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(404).json({ error: "User not found" });
  }

  try {
    await usersService.deleteUser(id);
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getUserPosts(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(404).json({ error: "User not found" });
  }

  const pagination = parsePagination(req.query);
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  try {
    const result = await usersService.getUserPosts(id, pagination);
    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(
      formatPaginatedResponse(result.posts, pagination.page, pagination.limit, result.total)
    );
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getUserLikedPosts(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(404).json({ error: "User not found" });
  }

  const pagination = parsePagination(req.query);
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  try {
    const result = await usersService.getUserLikedPosts(id, pagination);
    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(
      formatPaginatedResponse(result.posts, pagination.page, pagination.limit, result.total)
    );
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  create,
  list,
  getOne,
  update,
  remove,
  getUserPosts,
  getUserLikedPosts,
};
