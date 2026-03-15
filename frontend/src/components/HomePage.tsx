import { useRef, useState } from 'react';
import { sendChat, sendNeuronChat, type ChatMessage, type ChatResponse } from '../api';
import type { NeuronScoreResponse } from '../types';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  tokens?: { input: number; output: number };
  cost?: number;
  neurons_activated?: number;
  neuron_scores?: NeuronScoreResponse[];
}

export default function HomePage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<'haiku' | 'sonnet' | 'opus'>('haiku');
  const [useNeurons, setUseNeurons] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      let assistantMsg: Message;
      if (useNeurons) {
        const res = await sendNeuronChat(text, model);
        assistantMsg = {
          role: 'assistant',
          text: res.response,
          model: res.model,
          tokens: { input: res.input_tokens, output: res.output_tokens },
          cost: res.cost_usd,
          neurons_activated: res.neurons_activated,
          neuron_scores: res.neuron_scores,
        };
      } else {
        const history: ChatMessage[] = messages.map(m => ({ role: m.role, text: m.text }));
        const res: ChatResponse = await sendChat(text, model, history);
        assistantMsg = {
          role: 'assistant',
          text: res.response,
          model: res.model,
          tokens: { input: res.input_tokens, output: res.output_tokens },
          cost: res.cost_usd,
        };
      }
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
              <svg className="home-shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span>Query Lab</span>
            </button>
            <button className="home-shortcut" onClick={() => onNavigate('explorer')}>
              <svg className="home-shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="3" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="21" />
                <line x1="3" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="21" y2="12" />
              </svg>
              <span>Explorer</span>
            </button>
            <button className="home-shortcut" onClick={() => onNavigate('corvus-observations')}>
              <svg className="home-shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
              <span>Observations</span>
            </button>
            <button className="home-shortcut" onClick={() => onNavigate('dashboard')}>
              <svg className="home-shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 18 8 10 12 14 16 6 20 12" />
                <line x1="4" y1="20" x2="20" y2="20" />
              </svg>
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
                    <span>{msg.model}{msg.neurons_activated != null ? ' + neurons' : ''}</span>
                    {msg.neurons_activated != null && <span>{msg.neurons_activated} neurons</span>}
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
          <label className="home-neuron-toggle" title="Use neuron-enriched context from the knowledge graph">
            <input
              type="checkbox"
              checked={useNeurons}
              onChange={e => setUseNeurons(e.target.checked)}
            />
            <span className="home-neuron-toggle-label">Neurons</span>
          </label>
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
          <p className="home-input-hint">{useNeurons ? 'Responses enriched with knowledge graph context' : 'Direct LLM chat without neuron pipeline'}</p>
        )}
      </div>
    </div>
  );
}
