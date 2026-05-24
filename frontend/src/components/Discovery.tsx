import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Filter,
  Layers3,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { getPaperDetail, getRelatedPapers, searchPapers } from '../api/search';
import type {
  PDFDocument,
  PaperDetailResponse,
  PaperSearchResponse,
  PaperSearchResult,
  RelatedPapersResponse,
} from '../types';
import { cn } from '../lib/utils';

interface DiscoveryProps {
  papers: PDFDocument[];
  token?: string | null;
}

function formatAuthors(authors: string[]) {
  if (!authors.length) return 'Unknown authors';
  const head = authors.slice(0, 3).join(', ');
  return authors.length > 3 ? `${head} +${authors.length - 3}` : head;
}

function formatAbstract(abstract?: string | null, maxLength = 220) {
  if (!abstract) return 'No abstract available for this result.';
  if (abstract.length <= maxLength) return abstract;
  return `${abstract.slice(0, maxLength).trim()}…`;
}

function parseOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ResultCard({
  paper,
  onOpenDetail,
  actionLabel = 'Xem chi tiết',
}: {
  paper: PaperSearchResult;
  onOpenDetail: (paper: PaperSearchResult) => void;
  actionLabel?: string;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText size={18} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="line-clamp-2 text-base font-semibold text-gray-900">{paper.title}</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="rounded-full bg-gray-100 px-2 py-1 font-medium">{paper.year ?? 'n/a'}</span>
                <span className="rounded-full bg-gray-100 px-2 py-1 font-medium">{paper.citation_count} citations</span>
                {paper.venue ? (
                  <span className="rounded-full bg-gray-100 px-2 py-1 font-medium">{paper.venue}</span>
                ) : null}
              </div>
            </div>
          </div>

          <p className="text-sm leading-6 text-gray-600">{formatAbstract(paper.abstract)}</p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold uppercase tracking-wide text-gray-400">Authors</span>
            <span>{formatAuthors(paper.authors)}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => onOpenDetail(paper)}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
          >
            {actionLabel}
          </button>

          {paper.open_access_pdf ? (
            <a
              href={paper.open_access_pdf}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <ExternalLink size={14} />
              PDF
            </a>
          ) : (
            <span className="inline-flex items-center justify-center rounded-xl border border-dashed border-gray-200 px-3 py-2 text-xs font-semibold text-gray-400">
              No PDF link
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Discovery({ papers, token }: DiscoveryProps) {
  const [query, setQuery] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [minCitations, setMinCitations] = useState('');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PaperSearchResponse | null>(null);

  const [relatedSourceId, setRelatedSourceId] = useState('');
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [relatedResults, setRelatedResults] = useState<RelatedPapersResponse | null>(null);

  const [detailPaper, setDetailPaper] = useState<PaperDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const librarySourcePaper = useMemo(
    () => papers.find((paper) => paper.id === relatedSourceId) ?? null,
    [papers, relatedSourceId]
  );

  useEffect(() => {
    if (relatedSourceId && papers.some((paper) => paper.id === relatedSourceId)) {
      return;
    }

    const defaultPaper = papers.find((paper) => paper.status === 'indexed') ?? papers[0] ?? null;
    setRelatedSourceId(defaultPaper?.id ?? '');
  }, [papers, relatedSourceId]);

  const runSearch = async (nextOffset = 0) => {
    if (!query.trim()) {
      setSearchError('Nhập từ khóa để tìm paper.');
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const data = await searchPapers(query.trim(), token, {
        limit,
        offset: nextOffset,
        year_from: parseOptionalInt(yearFrom),
        year_to: parseOptionalInt(yearTo),
        min_citations: parseOptionalInt(minCitations),
      });
      setSearchResults(data);
      setOffset(nextOffset);
    } catch (error) {
      setSearchResults(null);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const runRelatedSearch = async () => {
    if (!relatedSourceId) {
      setRelatedError('Chọn một PDF trong library trước đã.');
      return;
    }

    setRelatedLoading(true);
    setRelatedError(null);

    try {
      const data = await getRelatedPapers(relatedSourceId, token);
      setRelatedResults(data);
    } catch (error) {
      setRelatedResults(null);
      setRelatedError(error instanceof Error ? error.message : 'Không thể tải papers liên quan');
    } finally {
      setRelatedLoading(false);
    }
  };

  const openDetail = async (paper: PaperSearchResult) => {
    setDetailPaper({ ...paper, reference_count: 0 });
    setDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await getPaperDetail(paper.s2_id, token);
      setDetailPaper(detail);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Không thể tải chi tiết paper');
    } finally {
      setDetailLoading(false);
    }
  };

  const totalSearchPages = searchResults ? Math.max(1, Math.ceil(searchResults.total / limit)) : 0;
  const currentSearchPage = searchResults ? Math.floor(offset / limit) + 1 : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-bg)]">
      <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-12">
        <header className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Search Papers</h2>
          <p className="text-sm text-gray-400">Discover academic papers from around the web.</p>
        </header>

        <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void runSearch(0);
                }
              }}
              placeholder="Search for papers by topic, title, or author..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-3.5 pl-12 pr-28 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => void runSearch(0)}
              disabled={searchLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                showFilters
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <Filter size={14} />
              Filters
            </button>

            <div className="text-sm text-gray-500">
              {searchResults ? (
                <span>
                  Showing page <span className="font-semibold text-gray-700">{currentSearchPage}</span> of{' '}
                  <span className="font-semibold text-gray-700">{totalSearchPages}</span>
                </span>
              ) : (
                <span>Chưa có kết quả tìm kiếm nào.</span>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="grid gap-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 md:grid-cols-4">
              <label className="space-y-2 text-sm">
                <span className="font-semibold text-gray-700">Year from</span>
                <input
                  type="number"
                  min="0"
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold text-gray-700">Year to</span>
                <input
                  type="number"
                  min="0"
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold text-gray-700">Min citations</span>
                <input
                  type="number"
                  min="0"
                  value={minCitations}
                  onChange={(e) => setMinCitations(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold text-gray-700">Limit</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {[5, 10, 15, 20].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {searchError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {searchError}
            </div>
          )}

          <div className="space-y-4">
              {searchLoading && (
                <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Đang tìm paper…
                  </span>
                </div>
              )}

              {!searchLoading && searchResults && searchResults.papers.length === 0 && (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
                  <BookOpen size={28} className="mb-3 text-gray-300" />
                  Không có kết quả phù hợp. Thử đổi từ khóa hoặc giảm bộ lọc nhé.
                </div>
              )}

              {searchResults && searchResults.papers.length > 0 && (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {searchResults.papers.map((paper) => (
                      <ResultCard key={paper.s2_id} paper={paper} onOpenDetail={openDetail} />
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="text-sm text-gray-600">
                      {searchResults.total} results · page {currentSearchPage} / {totalSearchPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void runSearch(Math.max(0, offset - limit))}
                        disabled={offset === 0 || searchLoading}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => void runSearch(offset + limit)}
                        disabled={offset + limit >= searchResults.total || searchLoading}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900">Related papers</h3>
              <p className="text-sm text-gray-500">Xem những paper có chủ đề gần với tài liệu bạn đang có.</p>
            </div>

            <div className="space-y-3">
              <label className="block space-y-2 text-sm">
                <span className="font-semibold text-gray-700">Source PDF</span>
                <select
                  value={relatedSourceId}
                  onChange={(e) => setRelatedSourceId(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/60 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {papers.length === 0 ? (
                    <option value="">Upload a paper first</option>
                  ) : (
                    papers.map((paper) => (
                      <option key={paper.id} value={paper.id}>
                        {paper.original_name} · {paper.status}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <button
                type="button"
                onClick={() => void runRelatedSearch()}
                disabled={relatedLoading || !relatedSourceId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {relatedLoading ? <Loader2 size={16} className="animate-spin" /> : <Layers3 size={16} />}
                {relatedLoading ? 'Loading related papers...' : 'Find related papers'}
              </button>

              {relatedError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {relatedError}
                </div>
              )}

              {relatedSourceId && librarySourcePaper && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">Selected source</p>
                  <p className="mt-1 truncate">{librarySourcePaper.original_name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">Status: {librarySourcePaper.status}</p>
                </div>
              )}
            </div>

            {relatedLoading && (
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Fetching related papers…
                </span>
              </div>
            )}

            {!relatedLoading && !relatedResults && !relatedError && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                Chưa có kết quả liên quan. Chọn PDF rồi bấm <span className="font-semibold text-gray-700">Find related papers</span>.
              </div>
            )}

            {relatedResults && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-white px-2 py-1 font-medium">Method: {relatedResults.method}</span>
                    <span className="rounded-full bg-white px-2 py-1 font-medium">{relatedResults.related_papers.length} papers</span>
                    <span className="rounded-full bg-white px-2 py-1 font-medium">{relatedResults.extracted_topics.length} topics</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Extracted topics</p>
                    <div className="flex flex-wrap gap-2">
                      {relatedResults.extracted_topics.length > 0 ? (
                        relatedResults.extracted_topics.map((topic) => (
                          <span
                            key={topic}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                          >
                            {topic}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No topics extracted.</span>
                      )}
                    </div>
                  </div>
                </div>

                {relatedResults.related_papers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                    Không tìm thấy paper liên quan phù hợp.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {relatedResults.related_papers.map((paper) => (
                      <ResultCard
                        key={paper.s2_id}
                        paper={paper}
                        onOpenDetail={openDetail}
                        actionLabel="Open detail"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
        </section>
      </div>

      <AnimatePresence>
        {detailPaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                    <BookOpen size={14} />
                    Paper detail
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{detailPaper.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-gray-100 px-2 py-1">{detailPaper.year ?? 'n/a'}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-1">{detailPaper.citation_count} citations</span>
                    <span className="rounded-full bg-gray-100 px-2 py-1">{detailPaper.reference_count} references</span>
                    {detailPaper.venue ? <span className="rounded-full bg-gray-100 px-2 py-1">{detailPaper.venue}</span> : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDetailPaper(null);
                    setDetailLoading(false);
                    setDetailError(null);
                  }}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6 p-6">
                {detailLoading && (
                  <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    <Loader2 size={16} className="animate-spin" />
                    Loading paper details…
                  </div>
                )}

                {detailError && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {detailError}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Abstract</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
                    {detailPaper.abstract || 'No abstract available.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Authors</p>
                  <div className="flex flex-wrap gap-2">
                    {detailPaper.authors.length > 0 ? (
                      detailPaper.authors.map((author) => (
                        <span key={author} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                          {author}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">Unknown authors</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {detailPaper.open_access_pdf ? (
                    <a
                      href={detailPaper.open_access_pdf}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      <ExternalLink size={16} />
                      Open PDF
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-gray-400">
                      <ExternalLink size={16} />
                      No open-access PDF
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}