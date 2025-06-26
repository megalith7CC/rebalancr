import { useRef, useEffect } from 'react';
import { M3Card, M3Button } from './ui/M3Components';
import { Bell, AlertCircle, TrendingUp, Zap, Activity, X, Check, RefreshCw, Trash2 } from 'lucide-react';
import { useNotifications, AIRecommendation } from '@/context/NotificationContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { 
    notifications,
    isExecuting,
    executeRecommendation,
    markAllAsRead,
    clearNotification
  } = useNotifications();

  const notificationRef = useRef<HTMLDivElement>(null);
  const isSmallScreen = useMediaQuery('(max-width: 640px)');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node) && isOpen) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'arbitrage': return <Zap className="w-5 h-5" style={{ color: 'var(--md-sys-color-primary)' }} />;
      case 'rebalance': return <Activity className="w-5 h-5" style={{ color: 'var(--md-sys-color-secondary)' }} />;
      case 'yield': return <TrendingUp className="w-5 h-5" style={{ color: 'var(--md-sys-color-tertiary)' }} />;
      case 'risk': return <AlertCircle className="w-5 h-5" style={{ color: 'var(--md-sys-color-error)' }} />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'border-error bg-error/10';
      case 'medium': return 'border-warning bg-warning/10';
      case 'low': return 'border-success bg-success/10';
      default: return 'border-outline bg-surface-variant';
    }
  };
  
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (!isOpen) return null;

  const maxHeight = typeof window !== 'undefined' 
    ? `${Math.max(300, window.innerHeight - 200)}px`
    : '400px';

  return (
    <div 
      className={`fixed ${isSmallScreen ? 'inset-x-0 top-14 mx-4' : 'absolute right-4 top-16'} z-20 w-full ${isSmallScreen ? '' : 'max-w-md'} animate-slideDown`}
      ref={notificationRef}
    >
      <M3Card variant="filled" className="p-3 w-full shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div style={{ 
              fontFamily: 'var(--md-sys-typescale-title-medium-font)',
              color: 'var(--md-sys-color-primary)' 
            }}>
              Notifications
            </div>
            {notifications.length > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs px-2 py-1 rounded hover:bg-black/5 flex items-center gap-1"
                style={{ color: 'var(--md-sys-color-primary)' }}
                aria-label="Mark all as read"
              >
                <Check size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-black/5"
            style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
            aria-label="Close notifications"
          >
            <X size={18} />
          </button>
        </div>
        
        {notifications.length === 0 ? (
          <div className="py-8 text-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            <div className="flex justify-center mb-3">
              <Bell size={24} style={{ color: 'var(--md-sys-color-outline)' }} />
            </div>
            <p style={{ fontFamily: 'var(--md-sys-typescale-body-medium-font)' }}>
              No notifications yet
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-outline)' }}>
              AI recommendations will appear here
            </p>
          </div>
        ) : (
          <ul 
            className="space-y-3 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300" 
            style={{ maxHeight }}
          >
            {notifications.map((notification) => {
              const isRecommendation = notification.type === 'ai_recommendation';
              const recommendation = isRecommendation ? notification.recommendation : null;
              
              return isRecommendation && recommendation ? (
                <li 
                  key={notification.id} 
                  className={`rounded border ${getUrgencyColor(recommendation.urgency)} relative`}
                  style={{ 
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    borderWidth: '1px'
                  }}
                >
                  <div className="p-3 space-y-3">
                    <button 
                      onClick={() => clearNotification(notification.id)} 
                      className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/5"
                      style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                      aria-label="Dismiss notification"
                    >
                      <X size={14} />
                    </button>
                    <div className="flex items-start space-x-3">
                      {getRecommendationIcon(recommendation.type)}
                      <div className="flex-1 pr-5">
                        <div className="flex items-center justify-between mb-1">
                          <h4 style={{ 
                            fontFamily: 'var(--md-sys-typescale-title-medium-font)',
                            color: 'var(--md-sys-color-on-surface)'
                          }}>
                            {recommendation.type.charAt(0).toUpperCase() + recommendation.type.slice(1)} Opportunity
                          </h4>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-1 rounded-full text-xs inline-block`} style={{
                            backgroundColor: `var(--md-sys-color-${recommendation.urgency === 'high' ? 'error' : recommendation.urgency === 'medium' ? 'warning' : 'success'})`,
                            color: `var(--md-sys-color-on-${recommendation.urgency === 'high' ? 'error' : recommendation.urgency === 'medium' ? 'warning' : 'success'})`,
                            fontFamily: 'var(--md-sys-typescale-label-small-font)'
                          }}>
                            {recommendation.urgency} priority
                          </span>
                          <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                            {new Date(notification.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p style={{ 
                          fontFamily: 'var(--md-sys-typescale-body-medium-font)',
                          color: 'var(--md-sys-color-on-surface-variant)'
                        }} className="mb-2">
                          {notification.text}
                        </p>
                        <div className="flex items-center space-x-4" style={{ 
                          fontFamily: 'var(--md-sys-typescale-label-medium-font)',
                          color: 'var(--md-sys-color-on-surface-variant)'
                        }}>
                          <span>Expected Gain: <strong>{formatPercentage(recommendation.expectedGain)}</strong></span>
                          <span>Confidence: <strong>{recommendation.confidence}%</strong></span>
                        </div>
                      </div>
                    </div>
                    <M3Button
                      variant="filled"
                      size="small"
                      fullWidth={true}
                      onClick={() => executeRecommendation(recommendation)}
                      disabled={isExecuting.has(recommendation.id)}
                      icon={isExecuting.has(recommendation.id) ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
                    >
                      {isExecuting.has(recommendation.id) ? 'Executing...' : 'Execute Now'}
                    </M3Button>
                  </div>
                </li>
              ) : (
                <li 
                  key={notification.id} 
                  className="text-sm p-3 rounded relative"
                  style={{ 
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    color: 'var(--md-sys-color-on-surface)' 
                  }}
                >
                  <button 
                    onClick={() => clearNotification(notification.id)} 
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/5"
                    style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                    aria-label="Dismiss notification"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex justify-between mb-1 pr-5">
                    <span style={{ fontWeight: 500 }}>Agent Update</span>
                    <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {new Date(notification.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {notification.text}
                </li>
              );
            })}
          </ul>
        )}
      </M3Card>
    </div>
  );
}

export function NotificationBell({ onClick }: { onClick: () => void }) {
  const { unreadCount, setIsOpen } = useNotifications();
  
  const handleClick = () => {
    onClick();
    setIsOpen(true);
  };
  
  return (
    <button 
      onClick={handleClick}
      className="relative p-2 rounded-full hover:bg-black/5 focus:outline-none"
      aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
    >
      <Bell className="w-5 h-5" style={{ color: 'var(--md-sys-color-on-surface)' }} />
      {unreadCount > 0 && (
        <span 
          className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full"
          style={{ 
            backgroundColor: 'var(--md-sys-color-error)',
            color: 'var(--md-sys-color-on-error)'
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
