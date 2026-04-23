const API_BASE = '/api/pdf';

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (response.ok) {
    return data;
  }

  const message = data?.detail || data?.message || response.statusText;
  throw new Error(message || 'Lỗi khi gọi API');
}

export async function fetchPdfs() {
  const response = await fetch(`${API_BASE}/`);
  return parseResponse(response);
}

export async function uploadPdfFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  return parseResponse(response);
}

export async function deletePdfById(id) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  return parseResponse(response);
}

export async function getPdfFileUrl(id) {
  const response = await fetch(`${API_BASE}/${id}/file?redirect=false`);
  return parseResponse(response);
}
