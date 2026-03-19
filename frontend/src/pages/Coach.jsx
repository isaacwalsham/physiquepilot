import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";
import PageHeader from "../components/PageHeader";

const BACKEND = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

const authFetch = async (path, opts = {}) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return fetch(`${BACKEND}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });
};

const CSS = `
  @keyframes pp-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.15; }
  }
  @keyframes ci-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30%           { transform: translateY(-5px); opacity: 1; }
  }

  .pilot-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 120px);
    min-height: 500px;
    font-family: var(--font-body);
  }

  /* ── Header bar ── */
  .pilot-header {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 0.85rem 1.1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.9rem;
    flex-shrink: 0;
  }
  .pilot-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .pilot-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 8px rgba(40,183,141,0.6);
    animation: pp-blink 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  .pilot-name {
    font-family: var(--font-display);
    font-size: 0.82rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-1);
    font-weight: 700;
  }
  .pilot-sub {
    font-size: 0.7rem;
    color: var(--text-3);
    margin-top: 0.15rem;
  }
  .pilot-clear-btn {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: all 0.15s;
  }
  .pilot-clear-btn:hover { border-color: var(--bad); color: var(--bad); }

  /* ── Messages ── */
  .pilot-messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 0.85rem;
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    scroll-behavior: smooth;
    margin-bottom: 0.9rem;
  }
  .pilot-messages::-webkit-scrollbar { width: 4px; }
  .pilot-messages::-webkit-scrollbar-track { background: transparent; }
  .pilot-messages::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 2px; }

  .pilot-welcome {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 2rem 1rem;
    text-align: center;
  }
  .pilot-welcome-icon {
    font-size: 2rem;
    color: var(--accent-2);
    opacity: 0.6;
  }
  .pilot-welcome-title {
    font-family: var(--font-display);
    font-size: 0.85rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-2);
  }
  .pilot-welcome-sub {
    font-size: 0.82rem;
    color: var(--text-3);
    max-width: 420px;
    line-height: 1.6;
  }

  .pilot-msg {
    display: flex;
    gap: 0.6rem;
    align-items: flex-end;
    max-width: 85%;
  }
  .pilot-msg.user      { align-self: flex-end;   flex-direction: row-reverse; }
  .pilot-msg.assistant { align-self: flex-start; }

  .pilot-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .pilot-msg.user      .pilot-avatar { background: var(--accent-2); color: #fff; }
  .pilot-msg.assistant .pilot-avatar { background: var(--surface-3); border: 1px solid var(--line-2); color: var(--accent-3); font-size: 0.55rem; }

  .pilot-bubble {
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .pilot-msg.user      .pilot-bubble { background: var(--accent-2); color: #fff; border-bottom-right-radius: 3px; }
  .pilot-msg.assistant .pilot-bubble { background: var(--surface-3); border: 1px solid var(--line-1); color: var(--text-1); border-bottom-left-radius: 3px; }

  /* ── Typing indicator ── */
  .pilot-typing {
    align-self: flex-start;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0 0.4rem;
  }
  .pilot-typing-dots { display: flex; gap: 3px; }
  .pilot-typing-dots span {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--accent-2);
    animation: ci-bounce 1.1s ease-in-out infinite;
  }
  .pilot-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .pilot-typing-dots span:nth-child(3) { animation-delay: 0.4s; }

  /* ── Input row ── */
  .pilot-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    flex-shrink: 0;
  }
  .pilot-input {
    flex: 1;
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 0.9rem;
    padding: 0.65rem 0.9rem;
    resize: none;
    min-height: 44px;
    max-height: 120px;
    outline: none;
    transition: border-color 0.15s;
  }
  .pilot-input:focus { border-color: var(--accent-2); }
  .pilot-input::placeholder { color: var(--text-3); font-size: 0.85rem; }
  .pilot-send-btn {
    width: 44px; height: 44px;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(181,21,60,0.4);
    background: linear-gradient(135deg, rgba(181,21,60,0.3), rgba(138,15,46,0.2));
    color: var(--text-1);
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .pilot-send-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(181,21,60,0.45), rgba(138,15,46,0.35));
    border-color: rgba(181,21,60,0.65);
  }
  .pilot-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Disclaimer ── */
  .pilot-disclaimer {
    margin-top: 0.6rem;
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.07em;
    color: var(--text-3);
    text-align: center;
    line-height: 1.5;
    flex-shrink: 0;
  }

  .pilot-error {
    background: rgba(181,21,60,0.1);
    border: 1px solid rgba(181,21,60,0.35);
    border-radius: var(--radius-md);
    color: var(--bad);
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    padding: 0.65rem 0.9rem;
    margin-bottom: 0.9rem;
    flex-shrink: 0;
  }
`;

function Coach() {
  const messagesEndRef = useRef(null);

  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [messages, setMessages]   = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending]     = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.user) { setError("Not logged in"); setLoading(false); return; }
      await loadHistory();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages]);

  const loadHistory = async () => {
    const r = await authFetch("/api/coach/history?limit=50");
    if (r.ok) {
      const d = await r.json();
      setMessages(d.messages || []);
    }
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || sending) return;
    setChatInput("");
    setSending(true);
    setMessages(prev => [...prev, { role: "user", content: text, created_at: new Date().toISOString() }]);

    const r = await authFetch("/api/coach/chat", {
      method: "POST",
      body: JSON.stringify({ message: text })
    });
    const d = await r.json();
    if (r.ok && d.ok) {
      setMessages(prev => [...prev, { role: "assistant", content: d.reply, created_at: new Date().toISOString() }]);
    } else {
      setMessages(prev => [...prev, { role: "assistant", content: `Sorry, I encountered an error: ${d.error || "Unknown error"}`, created_at: new Date().toISOString() }]);
    }
    setSending(false);
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear your entire conversation history with The Physique Pilot?")) return;
    await authFetch("/api/coach/history", { method: "DELETE" });
    setMessages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (loading) return <PhysiquePilotLoader />;

  return (
    <div className="pilot-page">
      <style>{CSS}</style>

      <PageHeader title="THE PILOT" />

      {error && <div className="pilot-error">{error}</div>}

      {/* Status bar */}
      <div className="pilot-header">
        <div className="pilot-header-left">
          <div className="pilot-dot" />
          <div>
            <div className="pilot-name">The Physique Pilot</div>
            <div className="pilot-sub">AI Coach · Powered by GPT-4o Mini</div>
          </div>
        </div>
        <button className="pilot-clear-btn" onClick={clearHistory}>Clear History</button>
      </div>

      {/* Messages */}
      <div className="pilot-messages">
        {messages.length === 0 ? (
          <div className="pilot-welcome">
            <div className="pilot-welcome-icon">◈</div>
            <div className="pilot-welcome-title">Start a Conversation</div>
            <div className="pilot-welcome-sub">
              Ask The Physique Pilot about your training, nutrition, recovery, or check-in data.
              The Pilot has access to your check-in history and adapts its advice to your goal.
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`pilot-msg ${msg.role}`}>
              <div className="pilot-avatar">
                {msg.role === "user" ? "YOU" : "PP"}
              </div>
              <div className="pilot-bubble">{msg.content}</div>
            </div>
          ))
        )}
        {sending && (
          <div className="pilot-typing">
            <div className="pilot-typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pilot-input-row">
        <textarea
          className="pilot-input"
          placeholder="Ask The Physique Pilot about your training, nutrition, or check-in data…"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={sending}
        />
        <button
          className="pilot-send-btn"
          onClick={sendMessage}
          disabled={sending || !chatInput.trim()}
          title="Send"
        >
          ➤
        </button>
      </div>

      <div className="pilot-disclaimer">
        The Physique Pilot provides general fitness guidance only. Always consult a qualified healthcare
        professional for medical advice. PED discussion is not supported.
      </div>
    </div>
  );
}

export default Coach;
