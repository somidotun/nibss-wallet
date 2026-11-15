export const pageOptions = (page?: number, limit?: number) => {
  const p = Number.isFinite(page) ? Math.max(1, Math.floor(page!)) : 1;
  const l = Number.isFinite(limit)
    ? Math.min(50, Math.max(1, Math.floor(limit!)))
    : 20;
  return { page: p, limit: l, skip: (p - 1) * l };
};

export const paginationMeta = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPreviousPage: page > 1,
});
