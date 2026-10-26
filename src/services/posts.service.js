const prisma = require("../db");

async function createPost(data) {
  const { imageUrl, caption, location, authorId } = data;

  // Verify author exists
  const author = await prisma.user.findUnique({
    where: { id: authorId },
  });
  if (!author) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  return await prisma.post.create({
    data: {
      imageUrl,
      caption: caption !== undefined ? caption : null,
      location: location !== undefined ? location : null,
      authorId,
    },
  });
}

async function listPosts({ skip, take, sortBy, order, location, search, from, to }) {
  const where = {};

  if (location) {
    where.location = { equals: location, mode: "insensitive" };
  }

  if (search) {
    where.caption = { contains: search, mode: "insensitive" };
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lt = new Date(to);
  }

  let orderBy;
  if (sortBy === "likes") {
    orderBy = [{ likes: { _count: order } }, { createdAt: "desc" }];
  } else {
    orderBy = { [sortBy]: order };
  }

  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullname: true,
          },
        },
        _count: {
          select: { likes: true },
        },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return { posts, total };
}

async function getPostById(id) {
  return await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          fullname: true,
        },
      },
      _count: {
        select: { likes: true },
      },
    },
  });
}

async function updatePost(id, data) {
  const { caption, location } = data;
  const updateData = {};
  if (caption !== undefined) updateData.caption = caption;
  if (location !== undefined) updateData.location = location;

  return await prisma.post.update({
    where: { id },
    data: updateData,
  });
}

async function deletePost(id) {
  return await prisma.post.delete({
    where: { id },
  });
}

module.exports = {
  createPost,
  listPosts,
  getPostById,
  updatePost,
  deletePost,
};
