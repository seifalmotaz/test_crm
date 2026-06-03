function parsePagination(query, maxPerPage = 100) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const perPage = Math.min(maxPerPage, Math.max(1, parseInt(query.per_page) || 20));
  const skip = (page - 1) * perPage;
  return { page, perPage, skip };
}

function buildPaginationMeta(page, perPage, total) {
  return {
    page,
    per_page: perPage,
    total,
    total_pages: Math.ceil(total / perPage),
  };
}

module.exports = { parsePagination, buildPaginationMeta };
