import type { ReactElement } from 'react';

// Portals render into <body>, so overlays follow the page theme, not the column.
export function OverlayNote(): ReactElement {
  return (
    <p className="mb-3 text-xs text-muted-foreground">
      Opens in the page theme — switch it with the toggle above.
    </p>
  );
}
