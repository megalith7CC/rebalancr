import { useState, useEffect } from 'react';

/**
 * Custom hook that returns whether the given media query matches
 * @param query Media query string to evaluate
 * @returns Boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Default to false on server or in unsupported browsers
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Return early if window is not available (SSR)
    if (typeof window === 'undefined') return;

    // Check if matchMedia is supported
    if (typeof window.matchMedia !== 'function') {
      console.warn('matchMedia is not supported in this browser');
      return;
    }
    
    // Create media query list
    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Define handler function
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    // Add listener for changes
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handler);
    }
    
    // Cleanup function
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handler);
      }
    };
  }, [query]);
  
  return matches;
}
