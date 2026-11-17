import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Submit button: disabled when there is nothing to save, spinner while saving. */
export function SaveButton({
  disabled,
  pending,
  children,
}: {
  disabled: boolean;
  pending: boolean;
  children: ReactNode;
}): ReactElement {
  const { t } = useTranslation('households');
  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('settings.saving')}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
