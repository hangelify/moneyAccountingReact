import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillPhotoDropzone } from './BillPhotoDropzone';

function renderEmpty(multiple: boolean): void {
  render(
    <BillPhotoDropzone
      photos={[]}
      multiple={multiple}
      clientError={null}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
    />
  );
}

describe('BillPhotoDropzone', () => {
  it('several-photo mode shows the 20-photo constraints', () => {
    renderEmpty(true);
    expect(
      screen.getByText('Up to 20 photos · JPEG, PNG or WebP')
    ).toBeInTheDocument();
  });

  it('single-photo mode shows the single-photo constraints', () => {
    renderEmpty(false);
    expect(
      screen.getByText('JPEG, PNG or WebP, up to 10 MB')
    ).toBeInTheDocument();
    expect(screen.queryByText(/up to 20 photos/i)).toBeNull();
  });
});
