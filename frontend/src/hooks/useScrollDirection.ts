import { useState, useEffect, useRef } from 'react';

type ScrollDirection = 'up' | 'down' | null;
type ScrollState = {
  direction: ScrollDirection;
  isScrolling: boolean;
  scrollY: number;
};

interface UseScrollDirectionOptions {
  threshold?: number; // Minimum scroll distance to trigger direction change
  initialDirection?: ScrollDirection;
  scrollableElement?: HTMLElement | null;
}

/**
 * Hook to detect scroll direction within a scrollable element
 * Returns scroll direction and state for auto-hiding headers
 */
export function useScrollDirection(options: UseScrollDirectionOptions = {}): ScrollState {
  const {
    threshold = 10, // Default: 10px scroll distance
    initialDirection = null,
    scrollableElement = null,
  } = options;

  const [direction, setDirection] = useState<ScrollDirection>(initialDirection);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Use provided element or default to window
    const scrollContainer = scrollableElement || window;
    const isWindow = scrollContainer === window;
    
    const handleScroll = () => {
      if (ticking.current) return;
      
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentScrollY = isWindow 
          ? window.scrollY || window.pageYOffset
          : (scrollContainer as HTMLElement).scrollTop;

        // Check if we've scrolled enough to trigger direction change
        const scrollDifference = Math.abs(currentScrollY - lastScrollY.current);
        
        if (scrollDifference >= threshold) {
          // Determine scroll direction
          if (currentScrollY > lastScrollY.current && currentScrollY > 0) {
            // Scrolling down
            setDirection('down');
          } else if (currentScrollY < lastScrollY.current) {
            // Scrolling up
            setDirection('up');
          }
          
          lastScrollY.current = currentScrollY;
          setScrollY(currentScrollY);
          setIsScrolling(true);
          
          // Reset scrolling state after scroll stops
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          
          scrollTimeoutRef.current = window.setTimeout(() => {
            setIsScrolling(false);
          }, 150);
        }
        
        ticking.current = false;
      });
    };

    // Add scroll listener
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial scroll position
    const initialScroll = isWindow 
      ? window.scrollY || window.pageYOffset
      : (scrollContainer as HTMLElement).scrollTop;
    lastScrollY.current = initialScroll;
    setScrollY(initialScroll);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [threshold, scrollableElement]);

  return {
    direction,
    isScrolling,
    scrollY,
  };
}

