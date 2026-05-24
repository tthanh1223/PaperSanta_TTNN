import type {
  PaperDetailResponse,
  PaperSearchResponse,
  RelatedPapersResponse,
} from '../types';

const API_BASE = '/api/search';

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: any;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (response.ok) {
    return data as T;
  }

  throw new Error(data?.detail || data?.message || response.statusText || 'API error');
}

export interface SearchPapersParams {
  limit?: number;
  offset?: number;
  year_from?: number;
  year_to?: number;
  min_citations?: number;
}

export async function searchPapers(
  query: string,
  token?: string | null,
  params: SearchPapersParams = {}
): Promise<PaperSearchResponse> {
  const searchParams = new URLSearchParams({ q: query });

  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
  if (params.year_from !== undefined) searchParams.set('year_from', String(params.year_from));
  if (params.year_to !== undefined) searchParams.set('year_to', String(params.year_to));
  if (params.min_citations !== undefined) searchParams.set('min_citations', String(params.min_citations));

  const res = await fetch(`${API_BASE}/papers?${searchParams.toString()}`, {
    headers: authHeaders(token),
  });

  return parseResponse(res);
}

export async function getPaperDetail(
  s2Id: string,
  token?: string | null
): Promise<PaperDetailResponse> {
  const res = await fetch(`${API_BASE}/papers/${encodeURIComponent(s2Id)}`, {
    headers: authHeaders(token),
  });

  return parseResponse(res);
}

export async function getRelatedPapers(
  pdfId: string,
  token?: string | null
): Promise<RelatedPapersResponse> {
  const res = await fetch(`${API_BASE}/related/${encodeURIComponent(pdfId)}`, {
    headers: authHeaders(token),
  });

  return parseResponse(res);
}