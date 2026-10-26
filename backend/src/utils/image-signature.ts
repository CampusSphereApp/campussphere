export const isSupportedImageHeader = (header: Buffer, mimeType?: string) => {
  const type = header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff ? 'image/jpeg'
    : header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'image/png'
    : header.length >= 12 && header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP' ? 'image/webp'
    : null;
  return type !== null && (!mimeType || mimeType === type);
};
