const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
export function validateImageFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!allowedTypes.includes(file.type)) return 'PNG・JPEG・WebP画像を選択してください。';
  if (file.size > 10 * 1024 * 1024) return '画像は10MB以下にしてください。';
  return null;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth * image.naturalHeight > 24_000_000 || !image.naturalWidth || !image.naturalHeight) {
        reject(new Error('画像は2400万画素以下にしてください。'));
      } else resolve(image);
    };
    image.onerror = () => reject(new Error('画像を読み込めませんでした。別の画像をお試しください。'));
    image.src = url;
  });
}
