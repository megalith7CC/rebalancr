import { useState, useEffect, useRef } from 'react';
import { aiAgentService, AIMessage } from '@/services/aiAgent';
import { M3Button, M3Card } from './ui/M3Components';
import { HelpCircle, X, Minimize2, ChevronUp } from 'lucide-react';

interface PortfolioAssistantProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function PortfolioAssistant({ isOpen, onClose }: PortfolioAssistantProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [assistantAvailable, setAssistantAvailable] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkStatus = () => {
      const status = aiAgentService.getStatus();
      setAssistantAvailable(status.connected);
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const listener = (message: AIMessage) => {
      if (message.metadata?.type !== 'notification') {
        setMessages(prev => [...prev, message]);
      }
    };
    aiAgentService.onMessage(listener);
    return () => aiAgentService.removeListener(listener);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !assistantAvailable) return;
    
    const userMessage: AIMessage = {
      type: 'user',
      text: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    try {
      const response = await aiAgentService.sendMessage(input);
      
      const assistantMessage: AIMessage = {
        type: 'ai',
        text: response.text,
        timestamp: Date.now(),
        metadata: response.metadata || { action: response.action }
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'ai',
        text: 'Sorry, I encountered an error processing your request. Please try again later.',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && messages.length === 0 && assistantAvailable) {
      setMessages([{
        type: 'ai',
        text: 'Hello! I\'m your Portfolio Assistant. How can I help with your investments today?',
        timestamp: Date.now()
      }]);
    }
  }, [isOpen, messages.length, assistantAvailable]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        width: '350px',
        maxWidth: 'calc(100vw - 2rem)',
        zIndex: 100,
        borderRadius: 'var(--md-sys-shape-corner-large)',
        overflow: 'hidden',
        boxShadow: 'var(--md-sys-elevation-level3)',
      }}
    >
      <M3Card className="flex flex-col h-[500px] max-h-[80vh]">
        {}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            borderBottom: '1px solid var(--md-sys-color-outline)',
          }}
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" style={{ color: 'var(--md-sys-color-primary)' }} />
            <span
              style={{
                fontFamily: 'var(--md-sys-typescale-title-medium-font)',
                fontSize: 'var(--md-sys-typescale-title-medium-size)',
                color: 'var(--md-sys-color-on-surface)',
              }}
            >
              Portfolio Assistant
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onClose?.()}
              className="p-1 rounded hover:bg-black/5"
              aria-label="Minimize"
            >
              <Minimize2 className="w-4 h-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }} />
            </button>
            <button
              onClick={() => onClose?.()}
              className="p-1 rounded hover:bg-black/5"
              aria-label="Close"
            >
              <X className="w-4 h-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }} />
            </button>
          </div>
        </div>

        {}
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{
            backgroundColor: 'var(--md-sys-color-surface)',
          }}
        >
          {!assistantAvailable ? (
            <div className="h-full flex items-center justify-center text-center p-4">
              <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Portfolio assistance is currently unavailable. Please try again later.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-4 ${msg.type === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.type === 'user'
                        ? 'bg-primary text-white rounded-tr-none'
                        : 'bg-surface-variant rounded-tl-none'
                    }`}
                    style={{
                      backgroundColor:
                        msg.type === 'user'
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-surface-container)',
                      color:
                        msg.type === 'user'
                          ? 'var(--md-sys-color-on-primary)'
                          : 'var(--md-sys-color-on-surface)',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {}
        <div
          className="p-3 border-t"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderColor: 'var(--md-sys-color-outline-variant)',
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about your portfolio..."
              disabled={!assistantAvailable || loading}
              className="flex-1 p-2 rounded"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                color: 'var(--md-sys-color-on-surface)',
                border: '1px solid var(--md-sys-color-outline-variant)',
              }}
            />
            <M3Button
              onClick={handleSend}
              disabled={!input.trim() || !assistantAvailable || loading}
              icon={<ChevronUp className="w-4 h-4" />}
              variant="filled"
            >
              {loading ? 'Sending...' : 'Send'}
            </M3Button>
          </div>
        </div>
      </M3Card>
    </div>
  );
}
