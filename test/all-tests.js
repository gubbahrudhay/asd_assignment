const { execSync } = require("child_process");

function seed() {
  execSync("npm run seed", { stdio: "pipe" });
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: {},
  };
  if (body !== null) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`http://localhost:3000${path}`, options);
  let json = null;
  const text = await res.text();
  try {
    if (text) json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return {
    status: res.status,
    headers: res.headers,
    body: json,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function getLookups() {
  const getAllUsers = await request("GET", "/users?limit=50");
  const usersByUsername = {};
  for (const u of getAllUsers.body.data) {
    usersByUsername[u.username] = u;
  }

  const getAllPosts = await request("GET", "/posts?limit=50");
  const postsByInsta = {};
  for (const p of getAllPosts.body.data) {
    const key = p.imageUrl.split("/")[4];
    postsByInsta[key] = p;
  }

  return { usersByUsername, postsByInsta };
}

async function run() {
  console.log("Starting full test suite on localhost:3000...");

  // 1. Health check
  const health = await request("GET", "/health");
  assert(health.status === 200, "Health status should be 200");
  assert(health.body.status === "OK", "Health body status should be OK");
  console.log("✔ GET /health passed");

  // Initial Seed
  seed();
  console.log("✔ Database seeded");

  // Problem 1: Basic User CRUD tests (Steps 04, 06, 07, 08)
  console.log("Testing Problem 1: Basic User CRUD...");
  // 1. Missing required field -> 400
  const uMissing = await request("POST", "/users", { username: "onlyname" });
  assert(uMissing.status === 400, "400 on missing required field");
  assert(uMissing.body.error === "username, email and fullname are required", "exact error message");

  // 2. Duplicate username or email -> 409
  const uDuplicate = await request("POST", "/users", {
    username: "riya_travels",
    email: "other@example.com",
    fullname: "Copy Cat",
  });
  assert(uDuplicate.status === 409, "409 on duplicate username");
  assert(uDuplicate.body.error === "username or email already taken", "exact error message");

  // 3. Create user ignoring extra fields (id, etc.) -> 201
  const uExtra = await request("POST", "/users", {
    username: "sneaky_test",
    email: "sneaky@example.com",
    fullname: "Sneaky Test",
    id: 9999,
  });
  assert(uExtra.status === 201, "201 on create user");
  assert(uExtra.body.id !== 9999, "id was auto-generated, not 9999");
  assert(uExtra.body.username === "sneaky_test", "username matches");
  assert(uExtra.body.isPrivate === false, "isPrivate defaults to false");
  const sneakyId = uExtra.body.id;

  // 4. GET /users/:id
  const uGetOne = await request("GET", `/users/${sneakyId}`);
  assert(uGetOne.status === 200, "200 on get user");
  assert(uGetOne.body.username === "sneaky_test", "username matches");

  const uGetOne404 = await request("GET", "/users/888888");
  assert(uGetOne404.status === 404, "404 on user not found");
  assert(uGetOne404.body.error === "User not found", "exact error message");

  // 5. PATCH /users/:id (username and email ignored)
  const uPatch = await request("PATCH", `/users/${sneakyId}`, {
    fullname: "Sneaky Updated",
    username: "cannot_change",
    isPrivate: true,
  });
  assert(uPatch.status === 200, "200 on patch user");
  assert(uPatch.body.fullname === "Sneaky Updated", "fullname updated");
  assert(uPatch.body.username === "sneaky_test", "username untouched");
  assert(uPatch.body.isPrivate === true, "isPrivate updated");

  // 6. DELETE /users/:id
  const uDel = await request("DELETE", `/users/${sneakyId}`);
  assert(uDel.status === 204, "204 on delete user");

  const uDel404 = await request("DELETE", `/users/${sneakyId}`);
  assert(uDel404.status === 404, "404 on delete nonexistent user");
  assert(uDel404.body.error === "User not found", "exact error message");

  // Re-seed for clean state for Part B
  seed();
  console.log("✔ Problem 1 User CRUD tests passed");

  // 2. Part B: GET /users pagination, sorting, filtering tests
  console.log("Testing GET /users pagination...");
  const uPage1 = await request("GET", "/users");
  assert(uPage1.status === 200, "status 200");
  assert(uPage1.body.data.length === 10, "10 users on page 1");
  assert(uPage1.body.data[0].username === "dev_shoots", "newest user dev_shoots first");
  assert(uPage1.body.meta.total === 12, "total 12");
  assert(uPage1.body.meta.totalPages === 2, "totalPages 2");

  const uPage2 = await request("GET", "/users?page=2");
  assert(uPage2.status === 200, "status 200");
  assert(uPage2.body.data.length === 2, "2 users on page 2");
  assert(uPage2.body.data[0].username === "arjun_clicks", "arjun_clicks on page 2");
  assert(uPage2.body.data[1].username === "riya_travels", "riya_travels on page 2");

  const uPage3Limit5 = await request("GET", "/users?page=3&limit=5");
  assert(uPage3Limit5.status === 200, "status 200");
  assert(uPage3Limit5.body.data.length === 2, "2 users on page 3 with limit 5");
  assert(uPage3Limit5.body.meta.totalPages === 3, "totalPages 3");

  const uLimit100 = await request("GET", "/users?limit=100");
  assert(uLimit100.body.data.length === 12, "cap at 50, all 12 returned");
  assert(uLimit100.body.meta.limit === 50, "limit capped at 50");

  const uPage5 = await request("GET", "/users?page=5");
  assert(uPage5.body.data.length === 0, "empty array for page 5");
  assert(uPage5.body.meta.total === 12, "total still 12");

  const uInvalidPage = await request("GET", "/users?page=0");
  assert(uInvalidPage.status === 400, "400 on page 0");
  assert(uInvalidPage.body.error === "page and limit must be positive integers", "exact error");

  const uInvalidLimit = await request("GET", "/users?limit=abc");
  assert(uInvalidLimit.status === 400, "400 on limit abc");
  assert(uInvalidLimit.body.error === "page and limit must be positive integers", "exact error");

  const uFloatPage = await request("GET", "/users?page=1.5");
  assert(uFloatPage.status === 400, "400 on page 1.5");
  assert(uFloatPage.body.error === "page and limit must be positive integers", "exact error");
  console.log("✔ GET /users pagination tests passed");

  console.log("Testing GET /users sorting...");
  const uSortUsername = await request("GET", "/users?sortBy=username&order=asc");
  assert(uSortUsername.body.data[0].username === "aditya_codes", "starts with aditya_codes");

  const uSortFullname = await request("GET", "/users?sortBy=fullname&order=desc&limit=3");
  assert(uSortFullname.body.data[0].username === "vikram.trek", "first is vikram.trek");
  assert(uSortFullname.body.data[1].username === "sara_sketches", "second is sara_sketches");
  assert(uSortFullname.body.data[2].username === "rohan_runs", "third is rohan_runs");

  const uSortAsc = await request("GET", "/users?order=asc&limit=2");
  assert(uSortAsc.body.data[0].username === "riya_travels", "oldest is riya_travels");
  assert(uSortAsc.body.data[1].username === "arjun_clicks", "second oldest is arjun_clicks");

  const uInvalidSortBy = await request("GET", "/users?sortBy=email");
  assert(uInvalidSortBy.status === 400, "400 on sortBy email");
  assert(uInvalidSortBy.body.error === "sortBy must be one of: createdAt, username, fullname", "exact error");

  const uInvalidOrder = await request("GET", "/users?order=sideways");
  assert(uInvalidOrder.status === 400, "400 on order sideways");
  assert(uInvalidOrder.body.error === "order must be asc or desc", "exact error");
  console.log("✔ GET /users sorting tests passed");

  console.log("Testing GET /users filtering...");
  const uPrivate = await request("GET", "/users?isPrivate=true");
  assert(uPrivate.body.meta.total === 4, "4 private users");
  assert(uPrivate.body.data[0].username === "dev_shoots", "dev_shoots first");

  const uPublic = await request("GET", "/users?isPrivate=false");
  assert(uPublic.body.meta.total === 8, "8 public users");

  const uSearchSh = await request("GET", "/users?search=sh");
  assert(uSearchSh.body.meta.total === 3, "3 users matching sh");
  const shUsernames = uSearchSh.body.data.map((u) => u.username);
  assert(shUsernames.includes("dev_shoots") && shUsernames.includes("isha_dances") && shUsernames.includes("riya_travels"), "matches username or fullname");

  const uSearchComb = await request("GET", "/users?search=SH&isPrivate=false&sortBy=fullname&order=asc&limit=2");
  assert(uSearchComb.body.data.length === 2, "2 results");
  assert(uSearchComb.body.data[0].username === "isha_dances", "isha_dances first");
  assert(uSearchComb.body.data[1].username === "riya_travels", "riya_travels second");

  const uSearchZzz = await request("GET", "/users?search=zzz");
  assert(uSearchZzz.body.data.length === 0, "empty array");
  assert(uSearchZzz.body.meta.total === 0, "total 0");
  assert(uSearchZzz.body.meta.totalPages === 0, "totalPages 0");

  const uInvalidPrivate = await request("GET", "/users?isPrivate=maybe");
  assert(uInvalidPrivate.status === 400, "400 on isPrivate maybe");
  assert(uInvalidPrivate.body.error === "isPrivate must be true or false", "exact error");
  console.log("✔ GET /users filtering tests passed");

  // 3. Part C: GET /posts pagination, sorting, filtering
  console.log("Testing GET /posts pagination & sorting...");
  const pPage1 = await request("GET", "/posts");
  assert(pPage1.body.meta.total === 24, "total 24");
  assert(pPage1.body.meta.totalPages === 3, "totalPages 3");
  assert(pPage1.body.data[0].imageUrl.includes("insta24"), "insta24 newest first");

  const pPage3 = await request("GET", "/posts?page=3");
  assert(pPage3.body.data.length === 4, "4 posts on page 3");
  assert(pPage3.body.data[3].imageUrl.includes("insta01"), "insta01 last");

  const pPage4 = await request("GET", "/posts?page=4");
  assert(pPage4.body.data.length === 0, "empty page 4");

  const pOrderAsc = await request("GET", "/posts?order=asc&limit=3");
  assert(pOrderAsc.body.data[0].imageUrl.includes("insta01"), "oldest insta01 first");

  const pInvalidLimit = await request("GET", "/posts?limit=0");
  assert(pInvalidLimit.status === 400, "400 on limit 0");
  assert(pInvalidLimit.body.error === "page and limit must be positive integers", "exact error");

  const pInvalidSort = await request("GET", "/posts?sortBy=caption");
  assert(pInvalidSort.status === 400, "400 on sortBy caption");
  assert(pInvalidSort.body.error === "sortBy must be one of: createdAt, updatedAt, likes", "exact error");

  const pInvalidOrder = await request("GET", "/posts?order=up");
  assert(pInvalidOrder.status === 400, "400 on order up");
  assert(pInvalidOrder.body.error === "order must be asc or desc", "exact error");
  console.log("✔ GET /posts pagination and sorting tests passed");

  console.log("Testing GET /posts filtering...");
  const pGoa = await request("GET", "/posts?location=GOA");
  assert(pGoa.body.meta.total === 4, "4 posts in Goa case-insensitive");
  const goaKeys = pGoa.body.data.map((p) => p.imageUrl.split("/")[4]);
  assert(goaKeys.includes("insta23") && goaKeys.includes("insta16") && goaKeys.includes("insta10") && goaKeys.includes("insta01"), "matched lowercase goa too");

  const pSunset = await request("GET", "/posts?search=sunset");
  assert(pSunset.body.meta.total === 3, "3 sunset posts");

  const pMarch = await request("GET", "/posts?from=2026-03-01&to=2026-04-01");
  assert(pMarch.body.meta.total === 8, "8 posts in March");

  const pAprilOnwards = await request("GET", "/posts?from=2026-04-01");
  assert(pAprilOnwards.body.meta.total === 8, "8 posts in April onwards");

  const pPuneChai = await request("GET", "/posts?location=pune&search=CHAI");
  assert(pPuneChai.body.meta.total === 1, "1 post in Pune with CHAI");
  assert(pPuneChai.body.data[0].imageUrl.includes("insta15"), "insta15 matched");

  const pMumbaiPage2 = await request("GET", "/posts?location=mumbai&limit=2&page=2");
  assert(pMumbaiPage2.body.data.length === 2, "2 posts on page 2 for mumbai");
  assert(pMumbaiPage2.body.data[0].imageUrl.includes("insta06"), "insta06 first on page 2");
  assert(pMumbaiPage2.body.data[1].imageUrl.includes("insta02"), "insta02 second on page 2");

  const pInvalidDate = await request("GET", "/posts?from=yesterday");
  assert(pInvalidDate.status === 400, "400 on invalid date");
  assert(pInvalidDate.body.error === "from and to must be valid dates", "exact error");
  console.log("✔ GET /posts filtering tests passed");

  // 4. Problem 3 Step 05 & 06: GET /posts/:id and GET /posts with sortBy=likes
  seed();
  let lookups = await getLookups();
  let riya = lookups.usersByUsername["riya_travels"];
  let arjun = lookups.usersByUsername["arjun_clicks"];
  let dev = lookups.usersByUsername["dev_shoots"];
  let aditya = lookups.usersByUsername["aditya_codes"];
  let neha = lookups.usersByUsername["neha_designs"];
  let insta01 = lookups.postsByInsta["insta01"];
  let insta05 = lookups.postsByInsta["insta05"];
  let insta10 = lookups.postsByInsta["insta10"];
  let insta24 = lookups.postsByInsta["insta24"];

  console.log("Testing GET /posts/:id with author summary and like count...");
  const pGetInsta01 = await request("GET", `/posts/${insta01.id}`);
  assert(pGetInsta01.status === 200, "200 on get insta01");
  assert(pGetInsta01.body.author.username === "riya_travels", "author riya_travels");
  assert(pGetInsta01.body.author.email === undefined, "no email in author summary");
  assert(pGetInsta01.body._count.likes === 5, "5 likes on insta01");

  const pGetInsta24 = await request("GET", `/posts/${insta24.id}`);
  assert(pGetInsta24.body.author.username === "dev_shoots", "author dev_shoots");
  assert(pGetInsta24.body._count.likes === 6, "6 likes on insta24");

  const pGetInsta05 = await request("GET", `/posts/${insta05.id}`);
  assert(pGetInsta05.body.author.username === "arjun_clicks", "author arjun_clicks");
  assert(pGetInsta05.body._count.likes === 0, "0 likes on insta05");

  const pGetNotFound = await request("GET", "/posts/999999");
  assert(pGetNotFound.status === 404, "404 on post not found");
  assert(pGetNotFound.body.error === "Post not found", "exact error");
  console.log("✔ GET /posts/:id tests passed");

  console.log("Testing GET /posts with sortBy=likes...");
  const pSortLikes = await request("GET", "/posts?sortBy=likes&limit=5");
  const topKeys = pSortLikes.body.data.map((p) => p.imageUrl.split("/")[4]);
  assert(topKeys[0] === "insta24", "insta24 (6 likes) first");
  assert(topKeys[1] === "insta01", "insta01 (5 likes) second");
  assert(topKeys[2] === "insta15" && topKeys[3] === "insta10" && topKeys[4] === "insta08", "the three 3s newest first: insta15, insta10, insta08");

  const pSortLikesAsc = await request("GET", "/posts?sortBy=likes&order=asc&limit=3");
  const bottomKeys = pSortLikesAsc.body.data.map((p) => p.imageUrl.split("/")[4]);
  assert(bottomKeys[0] === "insta23" && bottomKeys[1] === "insta21" && bottomKeys[2] === "insta19", "0 likes newest first: insta23, insta21, insta19");
  console.log("✔ GET /posts sortBy=likes tests passed");

  // Step 04: POST /posts and PATCH /posts/:id
  console.log("Testing Relations: POST /posts and PATCH /posts/:id...");
  const pCreateNoAuthor = await request("POST", "/posts", {
    imageUrl: "https://picsum.photos/seed/new02/600/600",
  });
  assert(pCreateNoAuthor.status === 400, "400 on missing authorId");
  assert(pCreateNoAuthor.body.error === "imageUrl and authorId are required", "exact error");

  const pCreateInvalidAuthor = await request("POST", "/posts", {
    imageUrl: "https://picsum.photos/seed/new03/600/600",
    authorId: 999999,
  });
  assert(pCreateInvalidAuthor.status === 404, "404 on invalid authorId");
  assert(pCreateInvalidAuthor.body.error === "User not found", "exact error");

  const pCreateSuccess = await request("POST", "/posts", {
    imageUrl: "https://picsum.photos/seed/new01/600/600",
    caption: "First post!",
    authorId: riya.id,
  });
  assert(pCreateSuccess.status === 201, "201 on success");
  assert(pCreateSuccess.body.authorId === riya.id, "authorId matches riya");

  const pPatchSteal = await request("PATCH", `/posts/${insta01.id}`, {
    caption: "Baga, again 🌅",
    authorId: arjun.id,
  });
  assert(pPatchSteal.status === 200, "200 on patch");
  assert(pPatchSteal.body.caption === "Baga, again 🌅", "caption updated");
  assert(pPatchSteal.body.authorId === riya.id, "authorId not stolen");
  console.log("✔ POST /posts and PATCH /posts/:id tests passed");

  // Step 07: GET /users/:id counts and hasPosts filter
  console.log("Testing GET /users/:id counts and hasPosts filter...");
  seed();
  lookups = await getLookups();
  riya = lookups.usersByUsername["riya_travels"];
  arjun = lookups.usersByUsername["arjun_clicks"];
  dev = lookups.usersByUsername["dev_shoots"];
  aditya = lookups.usersByUsername["aditya_codes"];
  neha = lookups.usersByUsername["neha_designs"];
  insta01 = lookups.postsByInsta["insta01"];
  insta05 = lookups.postsByInsta["insta05"];
  insta10 = lookups.postsByInsta["insta10"];
  insta24 = lookups.postsByInsta["insta24"];

  const uGetRiya = await request("GET", `/users/${riya.id}`);
  assert(uGetRiya.body._count.posts === 7, "riya has 7 posts");
  assert(uGetRiya.body._count.likes === 4, "riya liked 4 posts");

  const uGetDev = await request("GET", `/users/${dev.id}`);
  assert(uGetDev.body._count.posts === 2, "dev has 2 posts");
  assert(uGetDev.body._count.likes === 1, "dev liked 1 post");

  const uGetAditya = await request("GET", `/users/${aditya.id}`);
  assert(uGetAditya.body._count.posts === 0, "aditya has 0 posts");
  assert(uGetAditya.body._count.likes === 2, "aditya liked 2 posts");

  const uHasPostsFalse = await request("GET", "/users?hasPosts=false");
  assert(uHasPostsFalse.body.meta.total === 2, "2 users without posts");

  const uHasPostsTrue = await request("GET", "/users?hasPosts=true");
  assert(uHasPostsTrue.body.meta.total === 10, "10 users with posts");

  const uHasPostsPriv = await request("GET", "/users?hasPosts=true&isPrivate=true");
  assert(uHasPostsPriv.body.meta.total === 3, "3 private users with posts");

  const uInvalidHasPosts = await request("GET", "/users?hasPosts=yes");
  assert(uInvalidHasPosts.status === 400, "400 on hasPosts yes");
  assert(uInvalidHasPosts.body.error === "hasPosts must be true or false", "exact error");
  console.log("✔ GET /users/:id counts and hasPosts filter tests passed");

  console.log("Testing GET /users/:id/posts...");
  const uRiyaPosts = await request("GET", `/users/${riya.id}/posts?limit=3`);
  assert(uRiyaPosts.status === 200, "200 on riya posts");
  assert(uRiyaPosts.body.data.length === 3, "3 posts");
  assert(uRiyaPosts.body.data[0].author === undefined, "no author field in user posts");
  assert(uRiyaPosts.body.data[0]._count.likes !== undefined, "has like count");

  const uAdityaPosts = await request("GET", `/users/${aditya.id}/posts`);
  assert(uAdityaPosts.status === 200, "200 on aditya posts");
  assert(uAdityaPosts.body.data.length === 0, "empty posts");
  assert(uAdityaPosts.body.meta.total === 0, "total 0");
  assert(uAdityaPosts.body.meta.totalPages === 0, "totalPages 0");

  const uPostsNotFound = await request("GET", "/users/999999/posts");
  assert(uPostsNotFound.status === 404, "404 on user not found");
  assert(uPostsNotFound.body.error === "User not found", "exact error");

  const uPostsInvalidPage = await request("GET", `/users/${riya.id}/posts?page=0`);
  assert(uPostsInvalidPage.status === 400, "400 on page 0");
  console.log("✔ GET /users/:id/posts tests passed");

  console.log("Testing GET /posts/:id/likes...");
  const pLikes01 = await request("GET", `/posts/${insta01.id}/likes`);
  assert(pLikes01.status === 200, "200 on likes for insta01");
  assert(Array.isArray(pLikes01.body), "returns array");
  const likers01 = pLikes01.body.map((u) => u.username);
  assert(
    JSON.stringify(likers01) ===
      JSON.stringify(["arjun_clicks", "isha_dances", "meera.eats", "neha_designs", "vikram.trek"]),
    "sorted usernames asc for insta01"
  );

  const pLikes05 = await request("GET", `/posts/${insta05.id}/likes`);
  assert(pLikes05.body.length === 0, "0 likes on insta05");

  const pLikesNotFound = await request("GET", "/posts/999999/likes");
  assert(pLikesNotFound.status === 404, "404 on post not found");
  console.log("✔ GET /posts/:id/likes tests passed");

  console.log("Testing POST /posts/:id/likes and DELETE...");
  const likeAdd = await request("POST", `/posts/${insta05.id}/likes`, { userId: riya.id });
  assert(likeAdd.status === 201, "201 on like");
  assert(likeAdd.body.userId === riya.id && likeAdd.body.postId === insta05.id, "like object returned");

  const likeDup = await request("POST", `/posts/${insta05.id}/likes`, { userId: riya.id });
  assert(likeDup.status === 409, "409 on duplicate like");
  assert(likeDup.body.error === "Already liked", "exact error");

  const likeEmpty = await request("POST", `/posts/${insta05.id}/likes`, {});
  assert(likeEmpty.status === 400, "400 on empty userId");
  assert(likeEmpty.body.error === "userId is required", "exact error");

  const likePost404 = await request("POST", "/posts/999999/likes", { userId: riya.id });
  assert(likePost404.status === 404, "404 on post 999999");
  assert(likePost404.body.error === "Post not found", "exact error");

  const likeUser404 = await request("POST", `/posts/${insta05.id}/likes`, { userId: 999999 });
  assert(likeUser404.status === 404, "404 on user 999999");
  assert(likeUser404.body.error === "User not found", "exact error");

  const post05Check = await request("GET", `/posts/${insta05.id}`);
  assert(post05Check.body._count.likes === 1, "likes count is 1");

  const likeDel = await request("DELETE", `/posts/${insta05.id}/likes/${riya.id}`);
  assert(likeDel.status === 204, "204 on delete like");

  const likeDelAgain = await request("DELETE", `/posts/${insta05.id}/likes/${riya.id}`);
  assert(likeDelAgain.status === 404, "404 on delete like again");
  assert(likeDelAgain.body.error === "Like not found", "exact error");
  console.log("✔ Like and unlike tests passed");

  // 5. Cascading deletes test (Step 11)
  console.log("Testing Cascading Deletes (Step 11)...");
  seed();
  lookups = await getLookups();
  const riyaFresh = lookups.usersByUsername["riya_travels"];
  const arjunFresh = lookups.usersByUsername["arjun_clicks"];
  const insta10Fresh = lookups.postsByInsta["insta10"];
  const insta24Fresh = lookups.postsByInsta["insta24"];

  // Delete riya
  const delRiya = await request("DELETE", `/users/${riyaFresh.id}`);
  assert(delRiya.status === 204, "204 on delete riya");

  const uAfterRiya = await request("GET", "/users?limit=1");
  assert(uAfterRiya.body.meta.total === 11, "11 users remain");

  const pAfterRiya = await request("GET", "/posts?limit=1");
  assert(pAfterRiya.body.meta.total === 17, "17 posts remain (7 deleted)");

  const goaAfterRiya = await request("GET", "/posts?location=goa");
  assert(goaAfterRiya.body.data.length === 1 && goaAfterRiya.body.data[0].imageUrl.includes("insta10"), "only insta10 remains in Goa");

  const likes10 = await request("GET", `/posts/${insta10Fresh.id}/likes`);
  const likers10 = likes10.body.map((u) => u.username);
  assert(JSON.stringify(likers10) === JSON.stringify(["ananya_reads", "kabir_sings"]), "riya like gone from insta10");

  const likes24 = await request("GET", `/posts/${insta24Fresh.id}/likes`);
  const likers24 = likes24.body.map((u) => u.username);
  assert(!likers24.includes("riya_travels"), "riya like gone from insta24");

  const arjunAfter = await request("GET", `/users/${arjunFresh.id}`);
  assert(arjunAfter.body._count.posts === 4, "arjun posts still 4");
  assert(arjunAfter.body._count.likes === 2, "arjun likes dropped from 4 to 2 (cascaded from riya's posts)");

  const riyaPostsAfter = await request("GET", `/users/${riyaFresh.id}/posts`);
  assert(riyaPostsAfter.status === 404, "404 on deleted riya posts");
  console.log("✔ Cascading deletes tests passed");

  // 6. Bonus Step 12: GET /users/:id/liked-posts
  console.log("Testing GET /users/:id/liked-posts...");
  seed();
  lookups = await getLookups();
  const r2 = lookups.usersByUsername["riya_travels"];
  const a2 = lookups.usersByUsername["arjun_clicks"];
  const n2 = lookups.usersByUsername["neha_designs"];

  const rLiked = await request("GET", `/users/${r2.id}/liked-posts`);
  assert(rLiked.status === 200, "200 on riya liked posts");
  assert(rLiked.body.meta.total === 4, "total 4");
  const rLikedKeys = rLiked.body.data.map((p) => p.imageUrl.split("/")[4]);
  assert(
    JSON.stringify(rLikedKeys) === JSON.stringify(["insta24", "insta20", "insta10", "insta03"]),
    "riya liked posts in order: insta24, insta20, insta10, insta03"
  );

  const aLiked = await request("GET", `/users/${a2.id}/liked-posts?limit=2`);
  assert(aLiked.body.meta.total === 4, "arjun total 4");
  assert(aLiked.body.meta.totalPages === 2, "arjun totalPages 2");
  const aLikedKeys = aLiked.body.data.map((p) => p.imageUrl.split("/")[4]);
  assert(
    JSON.stringify(aLikedKeys) === JSON.stringify(["insta24", "insta14"]),
    "arjun page 1: insta24, insta14"
  );

  const nLiked = await request("GET", `/users/${n2.id}/liked-posts`);
  const nLikedKeys = nLiked.body.data.map((p) => p.imageUrl.split("/")[4]);
  assert(
    JSON.stringify(nLikedKeys) === JSON.stringify(["insta22", "insta15", "insta01"]),
    "neha liked: insta22, insta15, insta01"
  );

  // Create a new user
  const newUser = await request("POST", "/users", {
    username: "brand_new",
    email: "new@example.com",
    fullname: "Brand New",
  });
  const newLiked = await request("GET", `/users/${newUser.body.id}/liked-posts`);
  assert(newLiked.status === 200, "200 on new user liked posts");
  assert(newLiked.body.data.length === 0, "empty data");
  assert(newLiked.body.meta.total === 0, "total 0");
  assert(newLiked.body.meta.totalPages === 0, "totalPages 0");

  const user404Liked = await request("GET", "/users/999999/liked-posts");
  assert(user404Liked.status === 404, "404 on user 999999");
  assert(user404Liked.body.error === "User not found", "exact error");
  console.log("✔ GET /users/:id/liked-posts tests passed");

  // Clean up seed to leave database in known clean seeded state
  seed();
  console.log("✔ Final re-seed completed");

  console.log("\n=========================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("=========================================\n");
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
