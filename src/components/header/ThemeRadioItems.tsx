import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactElement } from 'react';
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/useTheme';
import type { Theme } from '@/lib/theme';

const OPTIONS: readonly { value: Theme; icon: LucideIcon }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
];

function isTheme(value: string): value is Theme {
  return OPTIONS.some((o) => o.value === value);
}

// The three theme choices, shared by the user menu and the guest toggle.
export function ThemeRadioItems(): ReactElement {
  const { t } = useTranslation('header');
  const { theme, setTheme } = useTheme();

  const handleChange = (value: string): void => {
    if (isTheme(value)) setTheme(value);
  };

  return (
    <DropdownMenuRadioGroup value={theme} onValueChange={handleChange}>
      {OPTIONS.map(({ value, icon: Icon }) => (
        <DropdownMenuRadioItem key={value} value={value}>
          <Icon className="mr-2 h-4 w-4" />
          {t(`theme.${value}`)}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
