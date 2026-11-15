import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/useTheme';
import { ThemeRadioItems } from './ThemeRadioItems';

// Theme switch for signed-out visitors; signed-in users get it in UserMenu.
export function ThemeToggle(): ReactElement {
  const { t } = useTranslation('header');
  const { resolvedTheme } = useTheme();
  const Icon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('theme.toggle')}>
          <Icon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ThemeRadioItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
