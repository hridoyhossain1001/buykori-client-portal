export type PrototypePage<T> = {
  items: T[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  historyMayBeIncomplete: boolean;
};

export type PageMetadata = {
  totalCount?: number;
  hasMore?: boolean;
};

export function makePrototypePage<T>(
  rows: T[],
  page: number,
  limit: number,
  metadata: PageMetadata = {},
): PrototypePage<T> {
  const safePage = Math.max(1, Math.trunc(page));
  const safeLimit = Math.max(1, Math.trunc(limit));
  const hasAuthoritativeTotal = Number.isInteger(metadata.totalCount) && Number(metadata.totalCount) >= 0;
  const totalCount = hasAuthoritativeTotal ? Number(metadata.totalCount) : rows.length;
  const offset = (safePage - 1) * safeLimit;
  const derivedHasMore = offset + safeLimit < totalCount;

  return {
    items: rows.slice(offset, offset + safeLimit),
    totalCount,
    page: safePage,
    limit: safeLimit,
    hasMore: typeof metadata.hasMore === "boolean" ? metadata.hasMore : derivedHasMore,
    historyMayBeIncomplete: !hasAuthoritativeTotal && typeof metadata.hasMore !== "boolean",
  };
}

