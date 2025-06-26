import { useState, useEffect, useRef } from 'react';
import { aiAgentService, AIMessage } from '@/services/aiAgent';
import { M3Button, M3Card, M3Fab } from './ui/M3Components';
import { Bot, X, Minimize2, ChevronUp } from 'lucide-react';

interface AIChatProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AIChat({ isOpen, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentAvailable, setAgentAvailable] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkStatus = () => {
      const status = aiAgentService.getStatus();
      setAgentAvailable(status.connected);
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
    if (!input.trim() || !agentAvailable) return;
    
    const userMessage: AIMessage = {
      type: 'user',
      text: input,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    try {
      await aiAgentService.sendMessage(userMessage.text);
    } catch (e) {
      setMessages(prev => [...prev, { 
        type: 'ai', 
        text: 'Error: Unable to reach agent.', 
        timestamp: Date.now() 
      }]);
    }
    
    setLoading(false);
  };


  if (onClose && !isOpen) return null;

  return (
    <div 
      className={`${onClose ? 'fixed bottom-24 right-8 z-40 w-96 shadow-xl animate-slideUp' : 'w-full'}`}
      style={{
        maxWidth: onClose ? '24rem' : '36rem',
        maxHeight: onClose ? 'calc(100vh - 12rem)' : 'none'
      }}
    >
      <M3Card variant="elevated" className="flex flex-col w-full h-full">
        {onClose && (
          <div 
            className="flex items-center justify-between p-3 border-b"
            style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}  
          >
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" style={{ color: 'var(--md-sys-color-primary)' }} />
              <span style={{ 
                fontFamily: 'var(--md-sys-typescale-title-medium-font)',
                color: 'var(--md-sys-color-on-surface)'
              }}>
                AI Assistant
              </span>
            </div>
            <div className="flex items-center">
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-black/5"
                aria-label="Minimize"
              >
                <Minimize2 className="w-4 h-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }} />
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-black/5" 
                aria-label="Close"
              >
                <X className="w-4 h-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }} />
              </button>
            </div>
          </div>
        )}
        
        <div 
          className="flex-1 overflow-y-auto p-3"
          style={{ 
            backgroundColor: 'var(--md-sys-color-surface-container)',
            minHeight: onClose ? '300px' : '240px',
            maxHeight: onClose ? '60vh' : 'none'
          }}
        >
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-center p-4"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
            >
              {agentAvailable ? 
                "Hello! How can I assist you with your portfolio today?" :
                "AI Agent is currently offline. Please try again later."}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`max-w-[80%] ${msg.type === 'user' ? 'ml-auto' : 'mr-auto'}`}>
                  <div 
                    className="inline-block p-3 rounded-lg"
                    style={{
                      backgroundColor: msg.type === 'user' 
                        ? 'var(--md-sys-color-primary-container)' 
                        : 'var(--md-sys-color-surface-container-high)',
                      color: msg.type === 'user'
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)'
                    }}
                  >
                    {msg.text}
                  </div>
                  <div 
                    className={`text-xs mt-1 ${msg.type === 'user' ? 'text-right' : ''}`}
                    style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
        
        <div 
          className="p-3 border-t flex gap-2 items-center"
          style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}
        >
          <input
            className="flex-1 px-3 py-2 rounded-full border"
            style={{ 
              borderColor: 'var(--md-sys-color-outline)',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)'
            }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={agentAvailable ? "Ask the AI assistant..." : "AI assistant unavailable"}
            disabled={loading || !agentAvailable}
          />
          <M3Button 
            variant="filled" 
            size="medium"
            onClick={handleSend} 
            disabled={loading || !input.trim() || !agentAvailable}
          >
            Send
          </M3Button>
        </div>
      </M3Card>
    </div>
  );
}
