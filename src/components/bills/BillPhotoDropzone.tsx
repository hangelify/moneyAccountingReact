import {
  useRef,
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
} from 'react';
import { ImageIcon, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { BATCH_MAX_FILES, BILL_IMAGE_MIME_TYPES } from '@/const/bills';
import { cn } from '@/lib/utils';

export interface SelectedPhoto {
  file: File;
  previewUrl: string;
  error: string | null;
}

interface BillPhotoDropzoneProps {
  photos: SelectedPhoto[];
  multiple: boolean;
  clientError: string | null;
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}

export function BillPhotoDropzone({
  photos,
  multiple,
  clientError,
  disabled,
  onAdd,
  onRemove,
}: BillPhotoDropzoneProps): ReactElement {
  const { t } = useTranslation('bills');
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = (): void => {
    if (!disabled) inputRef.current?.click();
  };

  const handleInput = (e: ChangeEvent<HTMLInputElement>): void => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) onAdd(picked);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLElement>): void => {
    e.preventDefault();
    if (disabled) return;
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) onAdd(multiple ? dropped : dropped.slice(0, 1));
  };

  const removeLabel = t('newBillModal.dropzone.remove');
  const first = photos[0];
  const canAddMore = multiple && photos.length < BATCH_MAX_FILES;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={BILL_IMAGE_MIME_TYPES.join(',')}
        multiple={multiple}
        className="hidden"
        onChange={handleInput}
      />

      {photos.length > 1 ? (
        <ul
          className="grid grid-cols-4 gap-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {photos.map((photo, index) => (
            <li key={photo.previewUrl} className="min-w-0 space-y-1">
              <div className="relative h-16 w-16">
                <img
                  src={photo.previewUrl}
                  alt={photo.file.name}
                  className={cn(
                    'h-16 w-16 rounded object-cover',
                    photo.error && 'ring-2 ring-destructive'
                  )}
                />
                <span className="absolute bottom-0.5 left-0.5 rounded bg-background/80 px-1 text-xs font-medium">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={disabled}
                  aria-label={removeLabel}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-foreground shadow disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {photo.error && (
                <p className="text-xs font-medium text-destructive">
                  {photo.error}
                </p>
              )}
            </li>
          ))}
          {canAddMore && (
            <li>
              <button
                type="button"
                onClick={openPicker}
                disabled={disabled}
                aria-label={t('newBillModal.dropzone.addMore')}
                className="flex h-16 w-16 items-center justify-center rounded border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:bg-accent/30 disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
              </button>
            </li>
          )}
        </ul>
      ) : first ? (
        <div
          className="space-y-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
            <img
              src={first.previewUrl}
              alt={first.file.name}
              className="h-16 w-16 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{first.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(first.file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(0)}
              disabled={disabled}
              aria-label={removeLabel}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {first.error && (
            <p className="text-sm font-medium text-destructive">
              {first.error}
            </p>
          )}
          {canAddMore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPicker}
              disabled={disabled}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t('newBillModal.dropzone.addMore')}
            </Button>
          )}
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
            {multiple
              ? t('newBillModal.dropzone.constraints')
              : t('newBillModal.dropzone.constraintsSingle')}
          </p>
        </div>
      )}

      {clientError && (
        <p className="text-sm font-medium text-destructive">{clientError}</p>
      )}
    </div>
  );
}
