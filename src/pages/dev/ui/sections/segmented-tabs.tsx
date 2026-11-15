import { useId, useState, type ReactElement } from 'react';
import { MemoryRouter, useInRouterContext } from 'react-router-dom';
import {
  SegmentedNav,
  SegmentedTabs,
  type SegmentedVariant,
} from '@/components/ui/segmented-tabs';

export const id = 'segmented-tabs';
export const title = 'SegmentedTabs';
export const order = 150;

type View = 'items' | 'chart' | 'map';

function Tabs({ variant }: { variant: SegmentedVariant }): ReactElement {
  const [view, setView] = useState<View>('items');
  // useId: the section renders twice, ids must not repeat.
  const ids = useId();
  return (
    <div className="grid gap-2">
      <SegmentedTabs<View>
        variant={variant}
        aria-label={`Views (${variant})`}
        idPrefix={ids}
        value={view}
        onValueChange={setView}
        items={[
          { value: 'items', label: 'Items' },
          { value: 'chart', label: 'Chart' },
          { value: 'map', label: 'Map', disabled: true },
        ]}
      />
      <div
        id={`${ids}-panel`}
        role="tabpanel"
        aria-labelledby={`${ids}-tab-${view}`}
        className="text-sm text-muted-foreground"
      >
        Panel: {view}. Arrows, Home and End move between tabs.
      </div>
    </div>
  );
}

function Nav(): ReactElement {
  return (
    <SegmentedNav
      aria-label="Showcase pages"
      items={[
        { to: '/dev/ui', end: true, label: 'Showcase' },
        { to: '/bills', label: 'Bills' },
        { to: '/bills/drafts', label: 'Drafts' },
      ]}
    />
  );
}

export function Section(): ReactElement {
  // The app's router can't hold a second one; the showcase test renders without any.
  const inRouter = useInRouterContext();
  return (
    <div className="grid gap-4">
      <Tabs variant="pill" />
      <Tabs variant="underline" />
      <div className="grid gap-1">
        {inRouter ? (
          <Nav />
        ) : (
          <MemoryRouter initialEntries={['/dev/ui']}>
            <Nav />
          </MemoryRouter>
        )}
        <p className="text-xs text-muted-foreground">
          SegmentedNav: real links, they leave the showcase.
        </p>
      </div>
    </div>
  );
}
