import { describe, expect, it } from 'vitest';
import { validateImageFile } from './image';

describe('local map image validation', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('accepts %s', type => {
    expect(validateImageFile({ type, size: 1000 })).toBeNull();
  });
  it('rejects external SVG and oversized files', () => {
    expect(validateImageFile({ type: 'image/svg+xml', size: 100 })).not.toBeNull();
    expect(validateImageFile({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).not.toBeNull();
  });
});
