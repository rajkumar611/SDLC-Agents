import { useEffect, useRef } from 'react';
import { Message } from '../App';
import MessageBubble from './MessageBubble';

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatPanel({ messages, isLoading }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="chat-empty">
        <div className="empty-icon">📋</div>
        <h2>Requirements Analysis Agent</h2>
        <p>
          Upload a requirements document or paste requirements text below.
          <br />
          The agent will extract acceptance criteria, flag ambiguities,
          detect prompt injection, and generate clarifying questions.
        </p>
        <div className="empty-hints">
          <span>✓ Given / When / Then</span>
          <span>✓ Injection detection</span>
          <span>✓ Ambiguity flagging</span>
          <span>✓ JSON output</span>
          <span>✓ MAS compliant</span>
        </div>
        <div className="empty-governance">
          <span>🔒 System prompt is governed and version-controlled · Build Lead access only</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} {...msg} />
      ))}
      {isLoading && (
        <div className="message agent">
          <div className="bubble loading-bubble">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
          <span className="timestamp">Analyzing…</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
