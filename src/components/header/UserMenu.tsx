import { LogOut, Settings, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import type { ReactElement } from 'react';

interface UserMenuProps {
  compact?: boolean; // true on mobile: hide the name, show avatar only
}

function displayName(user: {
  first_name?: string;
  last_name?: string;
  email: string;
}): string {
  if (user.first_name) {
    return user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.first_name;
  }
  return user.email;
}

export function UserMenu({
  compact = false,
}: UserMenuProps): ReactElement | null {
  const { t } = useTranslation('header');
  const { user, logout } = useAuth();

  if (!user) return null;

  const name = displayName(user);

  const handleLogout = (): void => {
    void logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 px-2"
          aria-label={t('menu.userMenu')}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4" />
          </span>
          {!compact && (
            <span className="max-w-[10rem] truncate text-sm font-medium">
              {name}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/households/settings">
            <Settings className="mr-2 h-4 w-4" />
            {t('menu.householdSettings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('menu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
