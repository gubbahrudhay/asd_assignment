const prisma = require("../src/db");
const { users, posts, likes } = require("./seed-data");

async function main() {
  try {
    // 1. Delete all rows from all three tables. Children first: likes, then posts, then users.
    await prisma.like.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();

    // 2. Create all users in one query and get created rows back with their ids.
    const createdUsers = await prisma.user.createManyAndReturn({
      data: users.map((u) => ({
        username: u.username,
        email: u.email,
        fullname: u.fullname,
        bio: u.bio,
        isPrivate: u.isPrivate,
        createdAt: new Date(u.createdAt),
      })),
    });

    // 3. Build lookup: username -> id
    const userMap = new Map();
    for (const u of createdUsers) {
      userMap.set(u.username, u.id);
    }

    // 4. Create all posts in one query, replacing author with real authorId.
    const mappedPosts = posts.map((p) => {
      const authorId = userMap.get(p.author);
      return {
        imageUrl: p.imageUrl,
        caption: p.caption,
        location: p.location,
        createdAt: new Date(p.createdAt),
        authorId,
      };
    });

    const createdPosts = await prisma.post.createManyAndReturn({
      data: mappedPosts,
    });

    // 5. Build lookup: insta## -> post id
    // imageUrl format: "https://picsum.photos/seed/insta01/600/600" -> split("/")[4] is "insta01"
    const postMap = new Map();
    for (const p of createdPosts) {
      const key = p.imageUrl.split("/")[4];
      postMap.set(key, p.id);
    }

    // 6. Create all likes in one query (real userId and postId)
    const mappedLikes = likes.map((l) => ({
      userId: userMap.get(l.user),
      postId: postMap.get(l.post),
    }));

    const createdLikesResult = await prisma.like.createMany({
      data: mappedLikes,
    });

    // 7. Print message with numbers from what queries returned
    console.log(
      `🌱 Seeded ${createdUsers.length} users, ${createdPosts.length} posts and ${createdLikesResult.count} likes`
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
