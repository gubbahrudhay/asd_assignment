function parsePagination(query) {
  let { page = "1", limit = "10" } = query;

  if (typeof page !== "string" || !/^\d+$/.test(page) || parseInt(page, 10) <= 0) {
    return { error: "page and limit must be positive integers" };
  }
  if (typeof limit !== "string" || !/^\d+$/.test(limit) || parseInt(limit, 10) <= 0) {
    return { error: "page and limit must be positive integers" };
  }

  const parsedPage = parseInt(page, 10);
  let parsedLimit = parseInt(limit, 10);
  if (parsedLimit > 50) {
    parsedLimit = 50;
  }

  const skip = (parsedPage - 1) * parsedLimit;
  const take = parsedLimit;

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip,
    take,
  };
}

function formatPaginatedResponse(data, page, limit, total) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

module.exports = {
  parsePagination,
  formatPaginatedResponse,
};
