import { formatSize } from '../utils/format';

function Viewer({ document, pdfUrl, onClose }) {
  if (!document) {
    return (
      <div className="viewer-body">
        <div className="placeholder">
          <div className="placeholder-icon">📑</div>
          <h2>PaperSanta</h2>
          <p>Chọn một PDF từ danh sách để xem</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="viewer-header">
        <div className="viewer-title">{document.original_name}</div>
        <div className="viewer-meta">
          {document.page_count ? `${document.page_count} trang · ` : ''}
          {formatSize(document.file_size)}
        </div>
        <button type="button" onClick={onClose}>
          ✕ Đóng
        </button>
      </div>
      <div className="viewer-body">
        {pdfUrl ? (
          <iframe className="pdf-frame" title="PDF preview" src={pdfUrl} />
        ) : (
          <div className="placeholder">
            <div className="placeholder-icon">📄</div>
            <h2>Đang tải PDF...</h2>
          </div>
        )}
      </div>
    </>
  );
}

export default Viewer;
