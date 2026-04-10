import { useState, useRef } from 'react';
import ChatPanel from './components/ChatPanel';
import FileUpload from './components/FileUpload';

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  injectionWarning?: string;
  timestamp: string;
  fileName?: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!input.trim() && !uploadedFile) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim() || `Analyzing uploaded document: ${uploadedFile?.name}`,
      timestamp: new Date().toISOString(),
      fileName: uploadedFile?.name,
    };

    setMessages((prev) => [...prev, userMessage]);
    const sentInput = input;
    const sentFile = uploadedFile;
    setInput('');
    setUploadedFile(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (sentInput.trim()) formData.append('message', sentInput);
      if (sentFile) formData.append('file', sentFile);

      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          content: data.response || JSON.stringify({ error: data.error }),
          injectionWarning: data.injectionWarning,
          timestamp: data.auditEntry?.timestamp || new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          content: JSON.stringify({ error: 'Failed to reach the agent. Check that the backend is running.' }),
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setInput('');
    setUploadedFile(null);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="header-icon">⚙</div>
            <div>
              <h1 className="header-title">FinServe Requirements Analysis Agent</h1>
              <span className="header-sub">Phase 1 — Requirements&nbsp;&nbsp;|&nbsp;&nbsp;MAS Compliant&nbsp;&nbsp;|&nbsp;&nbsp;NDA Active</span>
            </div>
          </div>
          <div className="header-right">
            <span className="badge badge-model">claude-sonnet-4-6</span>
            <span className="badge badge-gov">Governed · CLAUDE.md</span>
            {messages.length > 0 && (
              <button className="clear-btn" onClick={handleClear} title="Clear conversation">
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        <ChatPanel messages={messages} isLoading={isLoading} />
      </main>

      <footer className="input-area">
        <FileUpload
          uploadedFile={uploadedFile}
          onFileSelect={setUploadedFile}
          onFileClear={() => setUploadedFile(null)}
        />
        <div className="input-row">
          <textarea
            ref={inputRef}
            className="text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste requirements text here, or upload a document above… (Enter to send, Shift+Enter for new line)"
            rows={3}
            disabled={isLoading}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !uploadedFile)}
          >
            {isLoading ? (
              <span className="btn-loading">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </span>
            ) : (
              'Analyze'
            )}
          </button>
        </div>
        <p className="footer-note">
          System prompt is version-controlled and not editable by end users.
          This agent processes requirements only — no code generation.
        </p>
      </footer>
    </div>
  );
}

export default App;
