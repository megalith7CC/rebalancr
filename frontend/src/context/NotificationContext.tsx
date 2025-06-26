import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { aiAgentService, AIMessage } from '@/services/aiAgent';

export interface AIRecommendation {
  id: string;
  type: 'rebalance' | 'arbitrage' | 'yield' | 'risk';
  description: string;
  expectedGain: number;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
  timestamp: number;
  read?: boolean;
}

export interface Notification {
  id: string;
  text: string;
  timestamp: number;
  type: 'notification' | 'ai_recommendation';
  recommendation?: AIRecommendation;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isExecuting: Set<string>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  executeRecommendation: (recommendation: AIRecommendation) => Promise<void>;
  clearNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface AIRecommendationEvent extends CustomEvent {
  detail: AIRecommendation;
}

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rebalancr_notifications');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved notifications', e);
        }
      }
    }
    return [];
  });
  
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const count = localStorage.getItem('rebalancr_unread_count');
      return count ? parseInt(count, 10) : 0;
    }
    return 0;
  });
  
  const [isExecuting, setIsExecuting] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rebalancr_notifications', JSON.stringify(notifications));
    }
  }, [notifications]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rebalancr_unread_count', unreadCount.toString());
    }
  }, [unreadCount]);
  
  useEffect(() => {
    const count = notifications.filter(n => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);
  
  useEffect(() => {
    if (isOpen) {
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
    }
  }, [isOpen]);

  useEffect(() => {
    const handleAgentMessage = (message: AIMessage) => {
      if (message.metadata?.type === 'notification' || message.metadata?.type === 'ai_recommendation') {
        const newNotification: Notification = {
          id: `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          text: message.text,
          timestamp: message.timestamp,
          type: message.metadata.type,
          recommendation: message.metadata.recommendation,
          read: isOpen 
        };
        
        setNotifications(prev => [newNotification, ...prev.slice(0, 99)]); 
      }
    };
    
    const handlePortfolioRecommendation = (event: Event) => {
      const customEvent = event as AIRecommendationEvent;
      const recommendation = customEvent.detail;
      
      const newNotification: Notification = {
        id: `recommendation-${recommendation.id || Date.now()}`,
        text: recommendation.description,
        timestamp: recommendation.timestamp || Date.now(),
        type: 'ai_recommendation',
        recommendation: recommendation,
        read: isOpen 
      };
      
      setNotifications(prev => [newNotification, ...prev.slice(0, 99)]); 
    };
    
    const handleTransactionStatus = (event: Event) => {
      const customEvent = event as CustomEvent;
      const statusData = customEvent.detail;
      
      if (statusData) {
        if (statusData.recommendationId) {
          setNotifications(prev => 
            prev.filter(n => n.id !== `pending-${statusData.recommendationId}`)
          );
          
          const isSuccess = statusData.status === 'completed';
          const newNotification: Notification = {
            id: `tx-${statusData.recommendationId}-${Date.now()}`,
            text: isSuccess 
              ? `Successfully executed recommendation. Transaction: ${statusData.transactionHash || 'Pending'}`
              : `Transaction failed: ${statusData.message || 'Unknown error'}`,
            timestamp: Date.now(),
            type: 'notification',
            read: isOpen,
          };
          
          setNotifications(prev => [newNotification, ...prev.slice(0, 99)]);
        } else if (statusData.text) {
          const notification = statusData as Notification;
          notification.read = isOpen;
          setNotifications(prev => [notification, ...prev.slice(0, 99)]);
        }
      }
    };
    
    const handleWsConnectionStatus = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (!customEvent.detail.connected) {
        const connectionNotification: Notification = {
          id: `connection-${Date.now()}`,
          text: `Connection to data service lost. Attempting to reconnect...`,
          timestamp: Date.now(),
          type: 'notification',
          read: isOpen
        };
        
        setNotifications(prev => [connectionNotification, ...prev.slice(0, 99)]);
      }
    };
    
    aiAgentService.onMessage(handleAgentMessage);
    window.addEventListener('ai-recommendation', handlePortfolioRecommendation);
    window.addEventListener('transaction-status', handleTransactionStatus);
    window.addEventListener('ws-connection-status', handleWsConnectionStatus as EventListener);
    
    return () => {
      aiAgentService.removeListener(handleAgentMessage);
      window.removeEventListener('ai-recommendation', handlePortfolioRecommendation);
      window.removeEventListener('transaction-status', handleTransactionStatus);
      window.removeEventListener('ws-connection-status', handleWsConnectionStatus as EventListener);
    };
  }, [isOpen]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);
  
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  }, []);
  
  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);
  
  const executeRecommendation = useCallback(async (recommendation: AIRecommendation) => {
    if (!recommendation.id) return;
    
    setIsExecuting(prev => new Set(prev).add(recommendation.id));
    
    try {
      const executeData = {
        recommendationId: recommendation.id,
        type: recommendation.type,
        parameters: {
          expectedGain: recommendation.expectedGain,
          confidence: recommendation.confidence
        }
      };
      
      const wsExecuteEvent = new CustomEvent('execute-recommendation', {
        detail: executeData
      });
      window.dispatchEvent(wsExecuteEvent);
      
      const pendingNotification: Notification = {
        id: `pending-${recommendation.id}`,
        text: `Processing ${recommendation.type} recommendation...`,
        timestamp: Date.now(),
        type: 'notification',
        read: true 
      };
      
      setNotifications(prev => [pendingNotification, ...prev]);
      
      clearNotification(`recommendation-${recommendation.id}`);
    } catch (error) {
      console.error('Error executing recommendation:', error);
      
      const errorNotification: Notification = {
        id: `error-${Date.now()}`,
        text: `Failed to execute recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        type: 'notification',
        read: isOpen
      };
      
      setNotifications(prev => [errorNotification, ...prev]);
    } finally {
      setIsExecuting(prev => {
        const updated = new Set(prev);
        updated.delete(recommendation.id);
        return updated;
      });
    }
  }, [isOpen, clearNotification]);
  
  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isExecuting,
    isOpen,
    setIsOpen,
    markAllAsRead,
    markAsRead,
    executeRecommendation,
    clearNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

declare global {
  interface Window {
    rebalancr?: {
      websocket?: WebSocket;
    };
  }
}
