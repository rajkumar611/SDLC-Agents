import { useCallback, useState } from 'react';

interface FileUploadProps {
  uploadedFile: File | null;
  onFileSelect: (file: File) => void;
  onFileClear: () => void;
}

export default function FileUpload({ uploadedFile, onFileSelect, onFileClear }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = '';
  };

  if (uploadedFile) {
    return (
      <div className="file-attached">
        <span>📄 {uploadedFile.name}</span>
        <button onClick={onFileClear} title="Remove file">✕</button>
      </div>
    );
  }

  return (
    <div
      className={`file-drop-zone ${dragging ? 'dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
    >
      <input
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleChange}
        id="file-input"
        hidden
      />
      <label htmlFor="file-input">
        📎 Drop a requirements document here or <span className="browse-link">browse</span>
        <span className="file-types">&nbsp;(PDF · DOCX · TXT)</span>
      </label>
    </div>
  );
}
