import { Bot } from 'lucide-react';
import { M3Fab } from './ui/M3Components';
import { aiAgentService } from '@/services/aiAgent';
import { useState, useEffect } from 'react';

export function AIFloatingButton({ onClick }: { onClick: () => void }) {
  const [disabled, setDisabled] = useState(false);
  
  useEffect(() => {
    const checkStatus = () => {
      const status = aiAgentService.getStatus();
      setDisabled(!status.connected);
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <M3Fab 
      size="large" 
      icon={<Bot className="w-6 h-6" />}
      onClick={onClick}
      disabled={disabled}
      aria-label="Chat with AI"
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 50,
        opacity: disabled ? 0.5 : 1
      }}
    />
  );
}
