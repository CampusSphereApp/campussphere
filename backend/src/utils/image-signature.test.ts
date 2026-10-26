import { describe, expect, it } from 'vitest';
import { isSupportedImageHeader } from './image-signature.js';

describe('profile cover image signatures', () => {
  it.each([
    ['JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ['PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['WebP', Buffer.from('RIFF0000WEBP')]
  ])('accepts %s headers', (_name, header) => expect(isSupportedImageHeader(header)).toBe(true));

  it('rejects mismatched and truncated image types', () => {
    expect(isSupportedImageHeader(Buffer.from([0xff, 0xd8, 0xff]), 'image/png')).toBe(false);
    expect(isSupportedImageHeader(Buffer.from('RIFF0000WEB'))).toBe(false);
    expect(isSupportedImageHeader(Buffer.alloc(0))).toBe(false);
  });

  it('rejects a file whose MIME type was spoofed', () => {
    expect(isSupportedImageHeader(Buffer.from('<script>x</script>'))).toBe(false);
  });
});
