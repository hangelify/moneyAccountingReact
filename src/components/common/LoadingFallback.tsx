import type { ReactElement } from 'react';

export function LoadingFallback(): ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
