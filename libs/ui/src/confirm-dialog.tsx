import * as React from 'react';

import { Button, type buttonVariants } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import type { VariantProps } from 'class-variance-authority';

export interface ConfirmDialogProps {
  /** Element that opens the dialog — rendered as the DialogTrigger's child.
   * Must be a single element (DialogTrigger asChild slots it directly). */
  trigger: React.ReactElement;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel?: string;
  /** Shown on the confirm button while `onConfirm` is pending. */
  confirmingLabel?: string;
  cancelLabel?: string;
  /** Confirm button style — defaults to 'destructive' since most confirms
   * gate an irreversible action. */
  confirmVariant?: VariantProps<typeof buttonVariants>['variant'];
  onConfirm: () => Promise<void> | void;
  /** Default error text when `onConfirm` throws a non-Error value. */
  errorFallback?: string;
  contentClassName?: string;
}

/**
 * Confirm-a-destructive-action dialog, wrapping Dialog so call sites stop
 * hand-rolling the open/busy/error state + header/footer boilerplate. Stops
 * trigger clicks from propagating (table-row-safe) automatically.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmingLabel = 'Working…',
  cancelLabel = 'Cancel',
  confirmVariant = 'destructive',
  onConfirm,
  errorFallback = 'Something went wrong.',
  contentClassName,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorFallback);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setError(null);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        {trigger}
      </DialogTrigger>
      <DialogContent className={contentClassName ?? 'sm:max-w-md'} onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setError(null);
              setOpen(false);
            }}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={busy}>
            {busy ? confirmingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
