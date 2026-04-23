import { useCallback, useEffect, useState } from 'react';
import UploadZone from './components/UploadZone';
import PdfList from './components/PdfList';
import Viewer from './components/Viewer';
import ToastContainer from './components/ToastContainer';
import { fetchPdfs, getPdfFileUrl, uploadPdfFile, deletePdfById } from './api/pdf';
import { formatSize } from './utils/format';

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [statusText, setStatusText] = useState('Checking...');
  const [uploading, setUploading] = useState(false);
  const [toastList, setToastList] = useState([]);

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToastList((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToastList((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);
  };

  const loadDocuments = useCallback(async () => {
    try {
      const data = await fetchPdfs();
      setDocuments(data.documents ?? []);
    } catch (err) {
      addToast('Không kết nối được API', 'error', 5000);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch('/health');
      setStatusText(response.ok ? 'Online' : 'Offline');
    } catch {
      setStatusText('Offline');
    }
  }, []);

  useEffect(() => {
    loadDocuments();
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [loadDocuments, checkHealth]);

  useEffect(() => {
    if (!selectedDoc) {
      setPdfUrl('');
      return;
    }

    let canceled = false;
    const loadUrl = async () => {
      try {
        const data = await getPdfFileUrl(selectedDoc.id);
        if (!canceled) {
          setPdfUrl(data.url);
        }
      } catch {
        if (!canceled) {
          setPdfUrl(`/api/pdf/${selectedDoc.id}/file`);
        }
      }
    };

    loadUrl();
    return () => {
      canceled = true;
    };
  }, [selectedDoc]);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const result = await uploadPdfFile(file);
      addToast(`Upload thành công: ${result.original_name}`, 'success');
      await loadDocuments();
    } catch (err) {
      addToast(err.message || 'Upload thất bại', 'error', 5000);
    } finally {
      setUploading(false);
    }
  };

  const handleSelect = (doc) => {
    setSelectedDoc(doc);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Xóa "${doc.original_name}"?`)) {
      return;
    }

    try {
      await deletePdfById(doc.id);
      addToast(`Đã xóa: ${doc.original_name}`, 'success');
      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(null);
      }
      await loadDocuments();
    } catch (err) {
      addToast(err.message || 'Xóa thất bại', 'error', 5000);
    }
  };

  const totalSize = documents.reduce((sum, item) => sum + (item.file_size ?? 0), 0);

  return (
    <div className="app-shell">
      <header>
        <div className="logo">
          Paper<span>Santa</span>
        </div>
        <div className="tagline">PDF Storage · RAG Pipeline</div>
        <div className={`health-dot ${statusText === 'Online' ? 'ok' : ''}`} title="API Status" />
      </header>

      <aside>
        <div className="sidebar-top">
          <div className="sidebar-title">Upload PDF</div>
          <UploadZone onUpload={handleUpload} uploading={uploading} />
        </div>

        <div className="sidebar-title" style={{ padding: '0 20px', marginBottom: '8px' }}>
          Thư viện PDF
        </div>

        <div className="list-wrap">
          <PdfList
            documents={documents}
            activeId={selectedDoc?.id}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        </div>
      </aside>

      <main>
        <div className="stats-bar">
          <div className="stat">
            Tổng: <b>{documents.length}</b> files
          </div>
          <div className="stat">
            Kích thước: <b>{formatSize(totalSize)}</b>
          </div>
          <div className="stat">
            API: <b>{statusText}</b>
          </div>
        </div>

        <Viewer
          document={selectedDoc}
          pdfUrl={pdfUrl}
          onClose={() => setSelectedDoc(null)}
        />
      </main>

      <ToastContainer toasts={toastList} />
    </div>
  );
}

export default App;
