import React, { useState, useEffect, forwardRef } from 'react';

// Types
export interface M3ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'outlined' | 'text' | 'elevated' | 'filled-tonal';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
  loading?: boolean;
}

export interface M3CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'filled' | 'outlined';
  interactive?: boolean;
  children: React.ReactNode;
}

export interface M3FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'small' | 'medium' | 'large';
  icon: React.ReactNode;
  label?: string;
  extended?: boolean;
}

export interface M3ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'assist' | 'filter' | 'input' | 'suggestion';
  selected?: boolean;
  icon?: React.ReactNode;
  avatar?: React.ReactNode;
  onDelete?: () => void;
  children: React.ReactNode;
}

// Ripple Hook
const useRipple = () => {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const createRipple = (event: React.MouseEvent<HTMLElement>) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    const newRipple = { id: Date.now(), x, y };

    setRipples(prev => [...prev, newRipple]);
    setTimeout(() => setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id)), 400);
  };

  const rippleElements = ripples.map((ripple) => (
    <span
      key={ripple.id}
      className="ripple"
      style={{
        left: ripple.x,
        top: ripple.y,
        width: '20px',
        height: '20px',
      }}
    />
  ));

  return { createRipple, rippleElements };
};

// M3 Button Component
export const M3Button = forwardRef<HTMLButtonElement, M3ButtonProps>(({
  variant = 'filled',
  size = 'medium',
  icon,
  iconPosition = 'start',
  fullWidth = false,
  loading = false,
  children,
  className = '',
  onClick,
  disabled,
  ...props
}, ref) => {
  const { createRipple, rippleElements } = useRipple();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      createRipple(event);
      onClick?.(event);
    }
  };

  const sizeClasses = {
    small: 'px-4 py-2 text-sm h-8',
    medium: 'px-6 py-3 h-10',
    large: 'px-8 py-4 text-lg h-12'
  };

  const baseClasses = `md3-button md3-button--${variant} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`;
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      className={`${baseClasses} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={handleClick}
      disabled={isDisabled}
      {...props}
    >
      {rippleElements}
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {!loading && icon && iconPosition === 'start' && <span>{icon}</span>}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'end' && <span>{icon}</span>}
    </button>
  );
});

M3Button.displayName = 'M3Button';

// M3 Card Component
export const M3Card = forwardRef<HTMLDivElement, M3CardProps>(({
  variant = 'elevated',
  interactive = false,
  children,
  className = '',
  onClick,
  ...props
}, ref) => {
  const { createRipple, rippleElements } = useRipple();

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (interactive && onClick) {
      createRipple(event);
      onClick(event);
    }
  };

  const baseClasses = `md3-card md3-card--${variant} ${interactive ? 'cursor-pointer' : ''} ${className}`;

  return (
    <div
      ref={ref}
      className={baseClasses}
      onClick={handleClick}
      {...props}
    >
      {interactive && rippleElements}
      {children}
    </div>
  );
});

M3Card.displayName = 'M3Card';

// M3 FAB Component
export const M3Fab = forwardRef<HTMLButtonElement, M3FabProps>(({
  size = 'medium',
  icon,
  label,
  extended = false,
  className = '',
  onClick,
  disabled,
  ...props
}, ref) => {
  const { createRipple, rippleElements } = useRipple();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      createRipple(event);
      onClick?.(event);
    }
  };

  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-14 h-14',
    large: 'w-24 h-24'
  };

  const extendedClasses = extended ? 'px-4 w-auto min-w-[80px]' : sizeClasses[size];
  const baseClasses = `md3-fab ${extendedClasses} ${className}`;

  return (
    <button
      ref={ref}
      className={`${baseClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      {...props}
    >
      {rippleElements}
      {icon}
      {extended && label && <span className="ml-2">{label}</span>}
    </button>
  );
});

M3Fab.displayName = 'M3Fab';

// M3 Chip Component
export const M3Chip = forwardRef<HTMLDivElement, M3ChipProps>(({
  variant = 'assist',
  selected = false,
  icon,
  avatar,
  onDelete,
  children,
  className = '',
  onClick,
  ...props
}, ref) => {
  const { createRipple, rippleElements } = useRipple();

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    createRipple(event);
    onClick?.(event);
  };

  const baseClasses = `
    inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
    border transition-all duration-200 cursor-pointer relative overflow-hidden
    ${variant === 'assist' ? 'border-gray-300 hover:shadow-md' : ''}
    ${variant === 'filter' && selected ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300'}
    ${variant === 'input' ? 'bg-gray-100 border-gray-300' : ''}
    ${variant === 'suggestion' ? 'border-gray-300 hover:bg-gray-50' : ''}
    ${className}
  `;

  return (
    <div
      ref={ref}
      className={baseClasses}
      onClick={handleClick}
      {...props}
    >
      {rippleElements}
      {avatar && <span className="w-6 h-6 rounded-full overflow-hidden">{avatar}</span>}
      {icon && !avatar && <span>{icon}</span>}
      <span>{children}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-4 h-4 rounded-full hover:bg-gray-200 flex items-center justify-center"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      )}
    </div>
  );
});

M3Chip.displayName = 'M3Chip';

// M3 Text Field Component
export interface M3TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  supportingText?: string;
  error?: boolean;
  errorText?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  variant?: 'filled' | 'outlined';
}

export const M3TextField = forwardRef<HTMLInputElement, M3TextFieldProps>(({
  label,
  supportingText,
  error = false,
  errorText,
  leadingIcon,
  trailingIcon,
  variant = 'outlined',
  className = '',
  ...props
}, ref) => {
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  useEffect(() => {
    setHasValue(!!props.value || !!props.defaultValue);
  }, [props.value, props.defaultValue]);

  const containerClasses = `
    relative flex items-center
    ${variant === 'filled' ? 'bg-gray-100 rounded-t-lg border-b-2' : 'border-2 rounded-lg'}
    ${error ? 'border-red-500' : focused ? 'border-blue-500' : 'border-gray-300'}
    ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
    transition-all duration-200
  `;

  const inputClasses = `
    w-full px-4 py-3 bg-transparent outline-none
    ${leadingIcon ? 'pl-12' : ''}
    ${trailingIcon ? 'pr-12' : ''}
    ${variant === 'filled' ? 'pb-2' : ''}
  `;

  const labelClasses = `
    absolute left-4 transition-all duration-200 pointer-events-none
    ${leadingIcon ? 'left-12' : ''}
    ${focused || hasValue 
      ? `${variant === 'filled' ? 'top-1 text-xs' : '-top-2.5 text-xs bg-white px-1'} text-blue-500` 
      : 'top-3 text-gray-500'
    }
  `;

  return (
    <div className={className}>
      <div className={containerClasses}>
        {leadingIcon && (
          <span className="absolute left-3 text-gray-500">
            {leadingIcon}
          </span>
        )}
        
        <input
          ref={ref}
          className={inputClasses}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            setHasValue(!!e.target.value);
            props.onBlur?.(e);
          }}
          onChange={(e) => {
            setHasValue(!!e.target.value);
            props.onChange?.(e);
          }}
          {...props}
        />
        
        {label && (
          <label className={labelClasses}>
            {label}
          </label>
        )}
        
        {trailingIcon && (
          <span className="absolute right-3 text-gray-500">
            {trailingIcon}
          </span>
        )}
      </div>
      
      {(supportingText || errorText) && (
        <div className={`mt-1 text-xs px-4 ${error ? 'text-red-500' : 'text-gray-500'}`}>
          {error ? errorText : supportingText}
        </div>
      )}
    </div>
  );
});

M3TextField.displayName = 'M3TextField';

// M3 Switch Component
export interface M3SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export const M3Switch: React.FC<M3SwitchProps> = ({
  checked = false,
  onChange,
  disabled = false,
  label,
  className = ''
}) => {
  const handleChange = () => {
    if (!disabled) {
      onChange?.(!checked);
    }
  };

  const switchClasses = `
    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
    ${checked ? 'bg-blue-500' : 'bg-gray-300'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
  `;

  const thumbClasses = `
    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
    ${checked ? 'translate-x-6' : 'translate-x-1'}
    shadow-sm
  `;

  return (
    <div className={`flex items-center ${className}`}>
      <button
        type="button"
        className={switchClasses}
        onClick={handleChange}
        disabled={disabled}
        aria-checked={checked}
        role="switch"
      >
        <span className={thumbClasses} />
      </button>
      {label && (
        <span className={`ml-3 text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
          {label}
        </span>
      )}
    </div>
  );
};

// M3 Progress Indicator Component
export interface M3ProgressProps {
  variant?: 'linear' | 'circular';
  value?: number; // 0-100
  indeterminate?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const M3Progress: React.FC<M3ProgressProps> = ({
  variant = 'linear',
  value = 0,
  indeterminate = false,
  size = 'medium',
  className = ''
}) => {
  if (variant === 'circular') {
    const sizeClasses = {
      small: 'w-4 h-4',
      medium: 'w-6 h-6',
      large: 'w-8 h-8'
    };

    return (
      <div className={`${sizeClasses[size]} ${className}`}>
        <svg className="w-full h-full" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
          />
          {!indeterminate ? (
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={`${(value / 100) * 62.83} 62.83`}
              strokeLinecap="round"
              transform="rotate(-90 12 12)"
              className="transition-all duration-300"
            />
          ) : (
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="15.71 47.12"
              strokeLinecap="round"
              className="animate-spin"
            />
          )}
        </svg>
      </div>
    );
  }

  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div
        className={`h-2 rounded-full transition-all duration-300 ${
          indeterminate 
            ? 'bg-blue-500 animate-pulse' 
            : 'bg-blue-500'
        }`}
        style={{ width: indeterminate ? '100%' : `${value}%` }}
      />
    </div>
  );
};

export default {
  M3Button,
  M3Card,
  M3Fab,
  M3Chip,
  M3TextField,
  M3Switch,
  M3Progress,
};
