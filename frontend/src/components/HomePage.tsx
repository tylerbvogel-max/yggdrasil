import { useRef, useState } from 'react';
import { sendChat, type ChatMessage, type ChatResponse } from '../api';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  tokens?: { input: number; output: number };
  cost?: number;
}

export default function HomePage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<'haiku' | 'sonnet' | 'opus'>('haiku');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history: ChatMessage[] = messages.map(m => ({ role: m.role, text: m.text }));
      const res: ChatResponse = await sendChat(text, model, history);
      const assistantMsg: Message = {
        role: 'assistant',
        text: res.response,
        model: res.model,
        tokens: { input: res.input_tokens, output: res.output_tokens },
        cost: res.cost_usd,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${e instanceof Error ? e.message : 'Failed'}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="home-page">
      {!hasMessages && (
        <div className="home-hero">
          <img src="/corvus-logo.png" alt="Corvus" className="home-logo" />
          <h1 className="home-title">Corvus</h1>
          <p className="home-subtitle">Biomimetic knowledge graph for organizational intelligence</p>
          <div className="home-shortcuts">
            <button className="home-shortcut" onClick={() => onNavigate('query')}>
              <span className="home-shortcut-icon">&#9889;</span>
              <span>Query Lab</span>
            </button>
            <button className="home-shortcut" onClick={() => onNavigate('explorer')}>
              <span className="home-shortcut-icon">&#128065;</span>
              <span>Explorer</span>
            </button>
            <button className="home-shortcut" onClick={() => onNavigate('corvus-observations')}>
              <span className="home-shortcut-icon">&#128269;</span>
              <span>Observations</span>
            </button>
            <button className="home-shortcut" onClick={() => onNavigate('dashboard')}>
              <span className="home-shortcut-icon">&#128200;</span>
              <span>Dashboard</span>
            </button>
          </div>
        </div>
      )}

      {hasMessages && (
        <div className="home-chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`home-chat-msg home-chat-msg--${msg.role}`}>
              <div className="home-chat-bubble">
                <div className="home-chat-text">{msg.text}</div>
                {msg.role === 'assistant' && msg.model && (
                  <div className="home-chat-meta">
                    <span>{msg.model}</span>
                    {msg.tokens && <span>{msg.tokens.input + msg.tokens.output} tokens</span>}
                    {msg.cost != null && <span>${msg.cost.toFixed(4)}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="home-chat-msg home-chat-msg--assistant">
              <div className="home-chat-bubble">
                <span className="home-chat-typing">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className={`home-input-area${hasMessages ? ' home-input-area--bottom' : ''}`}>
        <div className="home-input-row">
          <select
            className="home-model-select"
            value={model}
            onChange={e => setModel(e.target.value as 'haiku' | 'sonnet' | 'opus')}
          >
            <option value="haiku">Haiku</option>
            <option value="sonnet">Sonnet</option>
            <option value="opus">Opus</option>
          </select>
          <textarea
            className="home-input"
            placeholder="Ask anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            rows={1}
          />
          <button className="home-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
            &#10148;
          </button>
        </div>
        {!hasMessages && (
          <p className="home-input-hint">Chat directly without invoking the neuron pipeline</p>
        )}
      </div>
    </div>
  );
}
