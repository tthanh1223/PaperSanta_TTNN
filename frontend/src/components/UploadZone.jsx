import { useRef, useState } from 'react';

function UploadZone({ onUpload, uploading }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (selected) => {
    if (!selected) {
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      return;
    }
    setFile(selected);
  };

  const handleChange = (event) => {
    const selected = event.target.files?.[0];
    handleFile(selected);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const selected = event.dataTransfer.files?.[0];
    handleFile(selected);
  };

  const handleUpload = () => {
    if (!file) {
      return;
    }
    onUpload(file);
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <div
        className={`upload-zone ${dragActive ? 'drag' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="upload-icon">📄</div>
        <p>Kéo thả PDF vào đây<br />hoặc click để chọn file</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden-input"
          onChange={handleChange}
        />
      </div>

      <div className="progress-controls">
        <button
          className="btn-upload"
          type="button"
          disabled={!file || uploading}
          onClick={handleUpload}
        >
          {uploading ? 'Đang upload...' : file ? `Upload "${file.name}"` : 'Chọn file để upload'}
        </button>
      </div>
    </>
  );
}

export default UploadZone;
