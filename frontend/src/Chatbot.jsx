import { useState, useRef, useEffect } from 'react';
import './Chatbot.css';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a helpful study assistant for a Smart Study Planner app used by university students. 
Your role is to:
- Help students plan their study sessions
- Give tips on how to study effectively
- Motivate students and keep them on track
- Answer questions about time management and academic success
- Keep responses short, friendly, and encouraging
- If asked anything unrelated to studying or academics, politely redirect the conversation back to studying.`;

export default function Chatbot({ onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "👋 Hi! I'm your Study Assistant. How can I help you today?",
    },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.text,
      }));

      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
         model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: userMessage },
          ],
        }),
      });

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content || 'Sorry, I could not understand that.';
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '❌ Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <div className="chatbot-header-info">
          <span className="chatbot-avatar">🤖</span>
          <div>
            <div className="chatbot-name">Study Assistant</div>
            <div className="chatbot-status">● Online</div>
          </div>
        </div>
        <button className="chatbot-close" onClick={onClose}>✕</button>
      </div>

      <div className="chatbot-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chatbot-message ${msg.role}`}>
            {msg.role === 'assistant' && <span className="chatbot-msg-avatar">🤖</span>}
            <div className="chatbot-bubble">{msg.text}</div>
          </div>
        ))}
        {loading && (
          <div className="chatbot-message assistant">
            <span className="chatbot-msg-avatar">🤖</span>
            <div className="chatbot-bubble chatbot-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chatbot-input-area">
        <textarea
          className="chatbot-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about studying..."
          rows={1}
        />
        <button
          className="chatbot-send"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
}