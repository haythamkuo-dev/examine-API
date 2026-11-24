import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type MouseEvent,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const modalExitDurationMs = 240;

type ModalOptions = {
  title: string;
  children: ReactNode;
  description?: string;
  dismissible?: boolean;
};

type ModalContextValue = {
  openModal: (options: ModalOptions) => void;
  closeModal: () => void;
  isOpen: boolean;
};

const ModalContext = createContext<ModalContextValue | null>(null);

const focusableSelector =
  [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

const getFirstFocusableElement = (root: HTMLElement | null): HTMLElement | null => {
  if (!root) {
    return null;
  }

  return root.querySelector<HTMLElement>(focusableSelector);
};

/**
 * Provides modal state and a portal rendering surface for the current UI scope.
 *
 * @param props Standard React children rendered inside the modal provider.
 * @returns Context provider that enables modal opening and closing within its scope.
 */
export function ModalProvider({ children }: PropsWithChildren) {
  const [modalOptions, setModalOptions] = useState<ModalOptions | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (!modalOptions) {
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');

      const previousElement = lastActiveElementRef.current;
      lastActiveElementRef.current = null;
      previousElement?.focus?.();
      return;
    }

    lastActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }, [modalOptions]);

  useEffect(() => {
    if (!modalOptions) {
      return;
    }

    const element =
      panelRef.current?.querySelector<HTMLElement>('[data-modal-autofocus="true"]') ??
      getFirstFocusableElement(panelRef.current) ??
      panelRef.current;
    element?.focus?.();
  }, [modalOptions]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const finishClose = useCallback(() => {
    clearCloseTimer();
    setModalOptions(null);
    setIsClosing(false);
  }, [clearCloseTimer]);

  const closeModal = useCallback(() => {
    setIsClosing(true);
    clearCloseTimer();
    closeTimerRef.current = setTimeout(finishClose, modalExitDurationMs);
  }, [clearCloseTimer, finishClose]);

  const openModal = useCallback((options: ModalOptions) => {
    clearCloseTimer();
    setIsClosing(false);
    setModalOptions(options);
  }, [clearCloseTimer]);

  useEffect(
    () => () => {
      clearCloseTimer();

      if (typeof document === 'undefined') {
        return;
      }

      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');

      const previousElement = lastActiveElementRef.current;
      lastActiveElementRef.current = null;
      if (previousElement?.isConnected) {
        previousElement.focus();
      }
    },
    [clearCloseTimer],
  );

  const handleExitAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLDivElement>) => {
      if (!isClosing || event.target !== event.currentTarget || event.animationName !== 'modal-backdrop-exit') {
        return;
      }

      finishClose();
    },
    [finishClose, isClosing],
  );

  const handleOverlayClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!modalOptions?.dismissible) {
        return;
      }

      if (event.target === event.currentTarget) {
        closeModal();
      }
    },
    [closeModal, modalOptions?.dismissible],
  );

  useEffect(() => {
    if (!modalOptions?.dismissible) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeModal, modalOptions?.dismissible]);

  const value = useMemo(
    () => ({
      openModal,
      closeModal,
      isOpen: modalOptions !== null,
    }),
    [closeModal, modalOptions, openModal],
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
      <div ref={setPortalRoot} data-global-modal-root="true" />
      {modalOptions && portalRoot
        ? createPortal(
            <div
              className={`${
                isClosing ? 'modal-backdrop-exit pointer-events-none' : 'modal-backdrop-enter'
              } fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--modal-backdrop-bg)] px-4 py-6 backdrop-blur-sm`}
              onMouseDown={handleOverlayClick}
              onAnimationEnd={handleExitAnimationEnd}
            >
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={modalOptions.description ? descriptionId : undefined}
                tabIndex={-1}
                className={`${
                  isClosing ? 'modal-panel-exit' : 'modal-panel-enter'
                } w-full max-w-[min(92vw,640px)] rounded-[28px] border border-[var(--operator-card-border)] bg-[var(--operator-panel-bg)] p-6 text-[var(--color-text)] shadow-[var(--modal-shadow)] outline-none sm:p-8`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 id={titleId} className="text-2xl font-semibold tracking-[-0.03em]">
                      {modalOptions.title}
                    </h2>
                    {modalOptions.description ? (
                      <p id={descriptionId} className="mt-2 text-sm leading-6 text-[color:var(--color-text-muted)]">
                        {modalOptions.description}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Close modal"
                    onClick={closeModal}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--operator-card-border)] bg-[var(--operator-ghost-button-bg)] text-[var(--color-text)] transition hover:bg-[var(--operator-ghost-button-hover-bg)]"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
                <div className="mt-6">{modalOptions.children}</div>
              </div>
            </div>,
            portalRoot,
          )
        : null}
    </ModalContext.Provider>
  );
}

/**
 * Reads the modal controller exposed by the nearest {@link ModalProvider}.
 *
 * @returns Modal control methods plus the current open state.
 * @throws {Error} When used outside `ModalProvider`.
 */
export function useModal() {
  const modal = useContext(ModalContext);

  if (!modal) {
    throw new Error('useModal must be used within ModalProvider.');
  }

  return modal;
}
