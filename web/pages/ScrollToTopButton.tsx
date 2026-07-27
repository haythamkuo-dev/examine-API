import { useEffect, useRef, useState } from 'react';
import { FaArrowUp } from 'react-icons/fa';

const scrollThreshold = 300;

/**
 * Provides an accessible control for returning the document to its top.
 *
 * @returns A floating back-to-top button once the user has scrolled past the threshold.
 */
export function ScrollToTopButton() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!(entry?.isIntersecting ?? true));
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, []);

  const scrollToTop = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <>
      <div
        ref={sentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-auto h-px w-px"
        style={{ top: `${scrollThreshold}px` }}
      />
      <button
        type="button"
        aria-label="Back to top"
        aria-hidden={!isVisible}
        title="Back to top"
        tabIndex={isVisible ? 0 : -1}
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--color-on-cta)] shadow-[var(--button-primary-shadow)] transition-[opacity,visibility,background-color,border-color] duration-200 hover:border-[var(--button-primary-hover-border)] hover:bg-[var(--button-primary-hover-bg)] sm:bottom-8 sm:right-8 ${isVisible ? 'visible cursor-pointer opacity-100' : 'invisible pointer-events-none opacity-0'}`}
      >
        <FaArrowUp aria-hidden="true" className="h-4 w-4" />
      </button>
    </>
  );
}
