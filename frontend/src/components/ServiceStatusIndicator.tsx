import { useState, useEffect } from 'react';
import { aiAgentService } from '@/services/aiAgent';
import { Tooltip } from '@/components/ui/Tooltip';

interface ServiceStatus {
  analysis: {
    active: boolean;
    lastChecked: Date;
  };
  dataFeed: {
    connected: boolean;
    error?: string;
    lastEvent: Date;
  };
}

export function ServiceStatusIndicator() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    analysis: {
      active: false,
      lastChecked: new Date()
    },
    dataFeed: {
      connected: false,
      lastEvent: new Date()
    }
  });

  useEffect(() => {
    const checkAnalysisStatus = () => {
      const status = aiAgentService.getStatus();
      setServiceStatus(prev => ({
        ...prev,
        analysis: {
          active: status.connected,
          lastChecked: new Date()
        }
      }));
    };
    
    checkAnalysisStatus();
    const interval = setInterval(checkAnalysisStatus, 30000);
    
    const handleDataFeedStatus = (event: Event) => {
      const customEvent = event as CustomEvent<{connected: boolean, error?: string}>;
      setServiceStatus(prev => ({
        ...prev,
        dataFeed: {
          connected: customEvent.detail.connected,
          error: customEvent.detail.error,
          lastEvent: new Date()
        }
      }));
    };
    
    window.addEventListener('ws-connection-status', handleDataFeedStatus as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('ws-connection-status', handleDataFeedStatus as EventListener);
    };
  }, []);

  let indicatorColor = 'var(--md-sys-color-error)';
  let statusLabel = 'Limited';
  
  const generateTooltipContent = () => {
    const { analysis, dataFeed } = serviceStatus;
    
    const analysisChecked = analysis.lastChecked.toLocaleTimeString();
    const dataFeedEvent = dataFeed.lastEvent.toLocaleTimeString();
    
    let details = `Portfolio Analysis: ${analysis.active ? '✓ Active' : '✗ Inactive'} (${analysisChecked})\n`;
    details += `Market Data Feed: ${dataFeed.connected ? '✓ Connected' : '✗ Disconnected'} (${dataFeedEvent})`;
    
    if (dataFeed.error) {
      details += `\nConnection issue: ${dataFeed.error}`;
    }
    
    if (analysis.active && dataFeed.connected) {
      details += '\n\nAll services operational';
    } else if (!analysis.active && !dataFeed.connected) {
      details += '\n\nServices unavailable';
    } else {
      details += '\n\nLimited services available';
    }
    
    return details;
  };
  
  if (serviceStatus.analysis.active && serviceStatus.dataFeed.connected) {
    indicatorColor = 'var(--md-sys-color-success)';
    statusLabel = 'Online';
  } else if (serviceStatus.analysis.active || serviceStatus.dataFeed.connected) {
    indicatorColor = 'var(--md-sys-color-warning)';
    statusLabel = 'Limited';
  }
  
  return (
    <Tooltip content={generateTooltipContent()}>
      <div className="flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: indicatorColor }}></span>
        <span className="text-xs" style={{ fontFamily: 'var(--md-sys-typescale-label-small-font)' }}>
          {statusLabel}
        </span>
      </div>
    </Tooltip>
  );
}
