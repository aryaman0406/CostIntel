import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Zap, RefreshCw, MessageSquare, Workflow, ChevronRight } from 'lucide-react';

const STARTER_QUESTIONS = [
  "Why didn't my Datadog payment reconcile?",
  'Show me my top spending categories',
  'What are my top vendors by cost?',
  'Run a balanced cost simulation',
  'What are my biggest savings opportunities?',
  'Summarize my current budget status',
];

const ToolBadge = ({ name }) => {
  const labels = {
    get_expense_summary: '📊 Expense Summary',
    get_category_totals: '📂 Category Totals',
    get_monitoring_recommendations: '🔍 Monitoring',
    run_simulation: '🎮 Simulation',
    get_top_vendors: '🏢 Top Vendors',
    get_reconciliation_exceptions: '🔄 Reconciliation Engine',
  };
  return (
    <span className="tool-badge">
      {labels[name] || `🔧 ${name}`}
    </span>
  );
};

const ReasoningChain = ({ steps, toolsUsed }) => {
  const [open, setOpen] = useState(false);

  // Normalize steps if only toolsUsed is available (backwards compatibility)
  const effectiveSteps = Array.isArray(steps) && steps.length > 0
    ? steps
    : Array.isArray(toolsUsed) && toolsUsed.length > 0
      ? toolsUsed.map((t, i) => ({
          step: i + 1,
          tool: t,
          result_summary: 'Executed and returned results',
        }))
      : [];

  if (effectiveSteps.length === 0) return null;

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        className="reasoning-toggle-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(prev => !prev);
        }}
        aria-expanded={open}
        aria-label="Toggle AI reasoning trace"
      >
        <Workflow size={13} style={{ color: 'var(--primary)' }} />
        <span>{open ? 'Hide reasoning' : 'Show reasoning'} ({effectiveSteps.length} step{effectiveSteps.length !== 1 ? 's' : ''})</span>
        <ChevronRight size={12} className={`recon-chevron ${open ? 'open' : ''}`} />
      </button>

      {open && (
        <div className="reasoning-trace-box">
          {effectiveSteps.map((step, idx) => (
            <div key={idx} className="reasoning-trace-step">
              <div className="reasoning-step-badge font-mono tabular-nums">
                {step.step || idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <span className="reasoning-tool-pill">
                  {step.tool}()
                </span>{' '}
                <span className="reasoning-step-desc">
                  → {step.result_summary || 'Completed successfully'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  const hasTools = msg.tools_used && msg.tools_used.length > 0;
  const hasSteps = msg.reasoning_steps && msg.reasoning_steps.length > 0;

  return (
    <div className={`chat-bubble-row ${isUser ? 'user' : 'bot'}`}>
      {!isUser && (
        <div className="chat-avatar bot-avatar">
          <Bot size={16} />
        </div>
      )}
      <div className={`chat-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
        {/* Tool badges summary */}
        {hasTools && (
          <div className="tool-badges">
            {msg.tools_used.map((t, i) => <ToolBadge key={i} name={t} />)}
          </div>
        )}

        <div className="bubble-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

        {/* Collapsed reasoning chain toggle */}
        {!isUser && (hasSteps || hasTools) && (
          <ReasoningChain steps={msg.reasoning_steps} toolsUsed={msg.tools_used} />
        )}

        {msg.timestamp && (
          <div className="bubble-time font-mono tabular-nums">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
      {isUser && (
        <div className="chat-avatar user-avatar">
          <User size={16} />
        </div>
      )}
    </div>
  );
};

const TypingIndicator = () => (
  <div className="chat-bubble-row bot">
    <div className="chat-avatar bot-avatar"><Bot size={16} /></div>
    <div className="chat-bubble bot-bubble">
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  </div>
);

const CFOChatTab = ({ onChat }) => {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: "Hello! I'm your AI-powered CFO Assistant.\n\nI can analyze your expenses, investigate failed reconciliation records, run what-if simulations, and answer any finance questions with live tool-calling reasoning.\n\nTry one of the questions below or ask me anything!",
      timestamp: new Date().toISOString(),
      tools_used: [],
      reasoning_steps: [],
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await onChat(text.trim());
      // result shape: { message: string, tools_used: string[], reasoning_steps?: list }
      const responseText = result?.message || result?.data?.message || result?.data || 'No response received.';
      const toolsUsed = result?.tools_used || result?.data?.tools_used || [];
      const reasoningSteps = result?.reasoning_steps || result?.data?.reasoning_steps || [];

      setMessages(prev => [...prev, {
        role: 'bot',
        content: typeof responseText === 'string' ? responseText : JSON.stringify(responseText, null, 2),
        timestamp: new Date().toISOString(),
        tools_used: toolsUsed,
        reasoning_steps: reasoningSteps,
      }]);
    } catch (e) {
      console.error('CFO Chat request failed:', e);
      setMessages(prev => [...prev, {
        role: 'bot',
        content: '❌ Connection error. Please try again.',
        timestamp: new Date().toISOString(),
        tools_used: [],
        reasoning_steps: [],
      }]);
    }
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="fade-in cfo-chat-page">
      {/* Header */}
      <div className="cfo-chat-header">
        <div className="cfo-chat-header-left">
          <div className="cfo-chat-icon">
            <MessageSquare size={24} />
          </div>
          <div>
            <h2 className="section-heading" style={{ margin: 0 }}>CFO AI Assistant</h2>
            <p className="card-subtitle" style={{ margin: 0 }}>Powered by Gemini · Tool-Calling Reasoning Trace</p>
          </div>
        </div>
        <div className="cfo-chat-status">
          <span className="pulse-dot active" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Online</span>
        </div>
      </div>

      {/* Starter chips — only show if only the welcome message is there */}
      {messages.length === 1 && (
        <div className="starter-chips">
          {STARTER_QUESTIONS.map((q, i) => (
            <button key={i} className="starter-chip" onClick={() => sendMessage(q)}>
              <Zap size={13} />
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="cfo-messages-area">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form className="cfo-chat-input-row" onSubmit={handleSubmit}>
        <textarea
          id="cfo-chat-input"
          className="cfo-chat-textarea"
          placeholder="Ask about your costs, budgets, or why a payment failed to reconcile..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={1}
        />
        <button
          id="cfo-chat-send"
          type="submit"
          className="btn btn-primary cfo-send-btn"
          disabled={loading || !input.trim()}
          aria-label="Send message"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
      <p className="cfo-chat-hint">Press Enter to send · Shift+Enter for new line</p>
    </div>
  );
};

export default CFOChatTab;
