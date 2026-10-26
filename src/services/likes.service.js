const prisma = require("../db");

async function getLikesForPost(postId) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });
  if (!post) {
    return null;
  }

  const likes = await prisma.like.findMany({
    where: { postId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullname: true,
        },
      },
    },
    orderBy: {
      user: {
        username: "asc",
      },
    },
  });

  return likes.map((l) => l.user);
}

async function addLike(postId, userId) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });
  if (!post) {
    return { error: "Post not found", status: 404 };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    return { error: "User not found", status: 404 };
  }

  try {
    const like = await prisma.like.create({
      data: {
        postId,
        userId,
      },
    });
    return { like, status: 201 };
  } catch (err) {
    if (err.code === "P2002") {
      return { error: "Already liked", status: 409 };
    }
    throw err;
  }
}

async function removeLike(postId, userId) {
  try {
    await prisma.like.delete({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });
    return { status: 204 };
  } catch (err) {
    if (err.code === "P2025") {
      return { error: "Like not found", status: 404 };
    }
    throw err;
  }
}

module.exports = {
  getLikesForPost,
  addLike,
  removeLike,
};
