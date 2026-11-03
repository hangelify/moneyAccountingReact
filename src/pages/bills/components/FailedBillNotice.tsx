import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useBillImage } from '@/hooks/useBillImage';
import type { BillDetailResponseDto } from '@/types/bills';

export interface FailedBillNoticeProps {
  bill: Pick<BillDetailResponseDto, 'id' | 'parse_error_message'>;
  // Mobile drawer: the photo can be collapsed to leave room for the form.
  collapsiblePhoto?: boolean;
}

// Above the form of a failed receipt: why it failed, and the photo to type
// the lines from.
export function FailedBillNotice({
  bill,
  collapsiblePhoto = false,
}: FailedBillNoticeProps): ReactElement {
  const { t } = useTranslation('bills');
  const { url } = useBillImage(bill.id);
  const [photoShown, setPhotoShown] = useState(true);
  const showPhoto = url !== null && (!collapsiblePhoto || photoShown);

  return (
    <div className="flex flex-col gap-3">
      <p
        role="status"
        className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
      >
        {bill.parse_error_message ?? t('failed.detailBanner')}
      </p>
      {collapsiblePhoto && url !== null && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          aria-expanded={photoShown}
          onClick={() => setPhotoShown((shown) => !shown)}
        >
          {photoShown ? t('failed.hidePhoto') : t('failed.showPhoto')}
        </Button>
      )}
      {showPhoto && (
        <img
          src={url}
          alt={t('failed.photoAlt')}
          className="max-h-64 w-full object-contain"
        />
      )}
    </div>
  );
}
