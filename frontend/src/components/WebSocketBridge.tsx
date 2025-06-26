import { useEffect, useRef, useState, useCallback } from 'react';
import { aiAgentService } from '@/services/aiAgent';

export function WebSocketBridge() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionsRef = useRef<string[]>([]);

  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocketBridge: Connected');
        setIsConnected(true);
        
        window.dispatchEvent(new CustomEvent('ws-connection-status', {
          detail: { connected: true }
        }));
        
        if (subscriptionsRef.current.length > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            topics: subscriptionsRef.current
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'ai_message':
            case 'agent_notification':
              aiAgentService.processIncomingMessage(data);
              break;
              
            case 'portfolio_update':
              window.dispatchEvent(new CustomEvent('portfolio-update', {
                detail: data.data
              }));
              break;
              
            case 'ai_recommendation':
              window.dispatchEvent(new CustomEvent('ai-recommendation', {
                detail: data.data
              }));
              break;
              
            case 'transaction_status':
              window.dispatchEvent(new CustomEvent('transaction-status', {
                detail: data.data
              }));
              break;
              
            default:
              window.dispatchEvent(new CustomEvent(`ws-${data.type}`, {
                detail: data.data
              }));
          }
        } catch (error) {
          console.error('WebSocketBridge: Error parsing message', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocketBridge: Disconnected', event.code, event.reason);
        setIsConnected(false);
        
        window.dispatchEvent(new CustomEvent('ws-connection-status', {
          detail: { connected: false }
        }));
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!event.wasClean) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocketBridge: Error', error);
        
        window.dispatchEvent(new CustomEvent('ws-connection-status', {
          detail: { connected: false, error: 'Connection error' }
        }));
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocketBridge: Failed to connect', error);
      
      window.dispatchEvent(new CustomEvent('ws-connection-status', {
        detail: { connected: false, error: 'Failed to establish connection' }
      }));
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    
    const handleExecuteRecommendation = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'execute_rebalancing',
          data: customEvent.detail
        }));
      } else {
        console.error('WebSocketBridge: Cannot execute recommendation - WebSocket not connected');
        
        window.dispatchEvent(new CustomEvent('transaction-status', {
          detail: {
            status: 'failed',
            recommendationId: customEvent.detail.recommendationId,
            message: 'WebSocket connection lost. Please try again.'
          }
        }));
      }
    };
    
    const handleSubscribe = (event: Event) => {
      const customEvent = event as CustomEvent;
      const topics = customEvent.detail.topics;
      
      subscriptionsRef.current = [...new Set([...subscriptionsRef.current, ...topics])];
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'subscribe',
          topics: topics
        }));
      }
    };
    
    const handleUnsubscribe = (event: Event) => {
      const customEvent = event as CustomEvent;
      const topics = customEvent.detail.topics;
      
      subscriptionsRef.current = subscriptionsRef.current.filter(
        topic => !topics.includes(topic)
      );
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe',
          topics: topics
        }));
      }
    };
    
    const handleSend = (event: Event) => {
      const customEvent = event as CustomEvent;
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(customEvent.detail));
      } else {
        console.error('WebSocketBridge: Cannot send message - WebSocket not connected');
        
        window.dispatchEvent(new CustomEvent('ws-send-failed', {
          detail: {
            originalMessage: customEvent.detail,
            error: 'WebSocket connection lost'
          }
        }));
      }
    };
    
    window.addEventListener('execute-recommendation', handleExecuteRecommendation as EventListener);
    window.addEventListener('ws-subscribe', handleSubscribe as EventListener);
    window.addEventListener('ws-unsubscribe', handleUnsubscribe as EventListener);
    window.addEventListener('ws-send', handleSend as EventListener);
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      window.removeEventListener('execute-recommendation', handleExecuteRecommendation as EventListener);
      window.removeEventListener('ws-subscribe', handleSubscribe as EventListener);
      window.removeEventListener('ws-unsubscribe', handleUnsubscribe as EventListener);
      window.removeEventListener('ws-send', handleSend as EventListener);
    };
  }, [connectWebSocket]);

  return null;  
}
