import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { Household } from '@/types/households';

export interface HouseholdSelectProps {
  households: Household[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function HouseholdSelect({
  households,
  value,
  onChange,
  disabled,
}: HouseholdSelectProps): ReactElement {
  const { t } = useTranslation('bills');

  return (
    <div className="space-y-1">
      <label htmlFor="household" className="text-sm font-medium">
        {t('newBillModal.household')}
      </label>
      <select
        id="household"
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {households.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </div>
  );
}
