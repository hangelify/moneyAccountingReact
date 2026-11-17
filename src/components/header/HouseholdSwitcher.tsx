import { ChevronDown, Wallet } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useHouseholds } from '@/contexts/HouseholdContext';
import { billDetailParent } from '@/lib/billDetailParent';
import type { ReactElement } from 'react';

export function HouseholdSwitcher(): ReactElement | null {
  const { t } = useTranslation('households');
  const { status, households, activeHousehold, setActiveHouseholdId } =
    useHouseholds();
  const location = useLocation();
  const navigate = useNavigate();

  if (status !== 'ready' || !activeHousehold) return null;

  const handleSelect = (id: string): void => {
    setActiveHouseholdId(id);
    const parent = billDetailParent(location.pathname);
    if (parent !== null) {
      const params = new URLSearchParams(location.search);
      params.delete('hid');
      const qs = params.toString();
      void navigate({ pathname: parent, search: qs ? `?${qs}` : '' });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 px-2"
          aria-label={t('switcher.label', { name: activeHousehold.name })}
        >
          <Wallet className="h-4 w-4" />
          <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">
            {activeHousehold.name}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('switcher.title')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={activeHousehold.id}
          onValueChange={handleSelect}
        >
          {households.map((h) => (
            <DropdownMenuRadioItem key={h.id} value={h.id}>
              <span className="truncate">{h.name}</span>
              <span className="ml-auto pl-2 text-xs text-muted-foreground">
                {h.currency}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/households">{t('switcher.manage')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
