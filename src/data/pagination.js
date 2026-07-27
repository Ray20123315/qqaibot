const PORTAL_PAGE_SIZE_MAX = 100;
const PORTAL_PAGE_SIZE_DEFAULT = 50;

function positiveInteger(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePortalPagination(pageValue, pageSizeValue, defaultPageSize = PORTAL_PAGE_SIZE_DEFAULT) {
  const page = positiveInteger(pageValue, 1);
  const fallback = Math.max(1, Math.min(PORTAL_PAGE_SIZE_MAX, positiveInteger(defaultPageSize, PORTAL_PAGE_SIZE_DEFAULT)));
  const pageSize = Math.max(1, Math.min(PORTAL_PAGE_SIZE_MAX, positiveInteger(pageSizeValue, fallback)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

async function collectFilteredPage(values, options = {}) {
  const rows = Array.isArray(values) ? values : [];
  const paging = normalizePortalPagination(options.page, options.pageSize, options.defaultPageSize);
  const maxScan = Math.max(paging.pageSize + 1, positiveInteger(options.maxScan, rows.length || paging.pageSize + 1));
  const load = typeof options.load === "function" ? options.load : async value => value;
  const match = typeof options.match === "function" ? options.match : () => true;
  const select = typeof options.select === "function" ? options.select : async value => value;
  const items = [];
  let matched = 0;
  let scanned = 0;
  let hasMore = false;
  let scanLimitReached = false;

  for (let index = 0; index < rows.length; index += 1) {
    if (scanned >= maxScan) {
      scanLimitReached = true;
      hasMore = true;
      break;
    }
    scanned += 1;
    const loaded = await load(rows[index], index);
    if (!loaded || !await match(loaded, rows[index], index)) continue;
    if (matched < paging.offset) {
      matched += 1;
      continue;
    }
    if (items.length >= paging.pageSize) {
      hasMore = true;
      break;
    }
    items.push(await select(loaded, rows[index], index));
    matched += 1;
  }

  return {
    items,
    pageInfo: {
      page: paging.page,
      pageSize: paging.pageSize,
      returned: items.length,
      hasMore,
      previousPage: paging.page > 1 ? paging.page - 1 : null,
      nextPage: hasMore ? paging.page + 1 : null,
      scanned,
      scanLimitReached
    }
  };
}

export { PORTAL_PAGE_SIZE_DEFAULT, PORTAL_PAGE_SIZE_MAX, collectFilteredPage, normalizePortalPagination };
