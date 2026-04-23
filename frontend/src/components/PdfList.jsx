import { formatSize, timeAgo } from '../utils/format';

function PdfList({ documents, activeId, onSelect, onDelete }) {
  if (!documents.length) {
    return <div className="empty-state">Chưa có file nào<br />Upload PDF để bắt đầu</div>;
  }

  return (
    <div>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={`pdf-item ${activeId === doc.id ? 'active' : ''}`}
          onClick={() => onSelect(doc)}
        >
          <div className="pdf-icon">PDF</div>
          <div className="pdf-meta">
            <div className="pdf-name" title={doc.original_name}>
              {doc.original_name}
            </div>
            <div className="pdf-info">
              {formatSize(doc.file_size)} · {doc.page_count ? `${doc.page_count} trang` : 'N/A'} · {timeAgo(doc.created_at)}
            </div>
            <span className={`pdf-status ${doc.status}`}>
              ● {doc.status}
            </span>
          </div>
          <button
            className="btn-del"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(doc);
            }}
            title="Xóa"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default PdfList;
