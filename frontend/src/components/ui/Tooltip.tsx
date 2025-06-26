'use client';

import React, { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  width?: string;
}

export function Tooltip({ 
  children, 
  content, 
  position = 'top',
  width = 'auto'
}: TooltipProps) {
  const formattedContent = content.split('\n').map((line, index) => (
    <React.Fragment key={index}>
      {line}
      {index < content.split('\n').length - 1 && <br />}
    </React.Fragment>
  ));
  
  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-1';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-1';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-1';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-1';
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-1';
    }
  };

  return (
    <div className="relative group">
      {children}
      <div 
        className={`absolute ${getPositionStyles()} px-3 py-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded z-50 whitespace-pre-wrap`}
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          color: 'var(--md-sys-color-on-surface)',
          boxShadow: 'var(--md-sys-elevation-level1)',
          width: width,
          maxWidth: '300px'
        }}
      >
        {formattedContent}
      </div>
    </div>
  );
}
