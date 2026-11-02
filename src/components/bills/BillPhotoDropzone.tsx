import {
  useRef,
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
} from 'react';
import { ImageIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { BILL_IMAGE_MIME_TYPES } from '@/const/bills';
import { cn } from '@/lib/utils';

interface BillPhotoDropzoneProps {
  file: File | null;
  previewUrl: string | null;
  clientError: string | null;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onClear: () => void;
}

export function BillPhotoDropzone({
  file,
  previewUrl,
  clientError,
  disabled,
  onFileSelected,
  onClear,
}: BillPhotoDropzoneProps): ReactElement {
  const { t } = useTranslation('bills');
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = (): void => {
    if (!disabled) inputRef.current?.click();
  };

  const handleInput = (e: ChangeEvent<HTMLInputElement>): void => {
    const picked = e.target.files?.[0];
    if (picked) onFileSelected(picked);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (disabled) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileSelected(dropped);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={BILL_IMAGE_MIME_TYPES.join(',')}
        className="hidden"
        onChange={handleInput}
      />

      {file && previewUrl ? (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
          <img
            src={previewUrl}
            alt={file.name}
            className="h-16 w-16 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClear}
            disabled={disabled}
            aria-label={t('newBillModal.dropzone.remove')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition-colors',
            disabled
              ? 'pointer-events-none opacity-50'
              : 'hover:border-primary hover:bg-accent/30'
          )}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {t('newBillModal.dropzone.empty')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('newBillModal.dropzone.constraints')}
          </p>
        </div>
      )}

      {clientError && (
        <p className="text-sm font-medium text-destructive">{clientError}</p>
      )}
    </div>
  );
}
