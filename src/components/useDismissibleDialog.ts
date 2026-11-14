import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type SyntheticEvent } from 'react';

/** Keeps a native modal dialog in sync with React state and makes its backdrop dismiss it. */
export function useDismissibleDialog(open: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const onCancel = useCallback((event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onDismiss();
  }, [onDismiss]);

  const onClick = useCallback((event: ReactMouseEvent<HTMLDialogElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) onDismiss();
  }, [onDismiss]);

  return { ref, onCancel, onClick };
}
