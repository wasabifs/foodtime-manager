import { useState, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_BASE64_SIZE = 800 * 1024; // 800KB for base64 fallback

function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context failed')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export function useImageUpload(uid: string) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(async (file: File): Promise<string | null> => {
    setUploadError(null);
    setProgress(0);

    if (!file.type.startsWith('image/')) {
      setUploadError('請選擇圖片檔案');
      return null;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('檔案太大，請選擇小於 5MB 的圖片');
      return null;
    }

    setIsUploading(true);

    try {
      // First try Firebase Storage
      const safeName = (file.name || 'image.jpg').replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `${Date.now()}_${safeName}`;
      const storageRef = ref(storage, `recipes/${uid}/${fileName}`);

      setProgress(30);
      const snapshot = await uploadBytes(storageRef, file);
      setProgress(70);
      const url = await getDownloadURL(snapshot.ref);
      setProgress(100);

      if (!url) throw new Error('Download URL is empty');
      return url;
    } catch (storageError: any) {
      // Firebase Storage failed — fallback to base64
      console.warn('Firebase Storage upload failed, falling back to base64:', storageError.code || storageError.message);

      try {
        setProgress(40);
        // Compress the image for base64 storage
        const compressed = await compressImage(file, 800, 0.6);
        setProgress(70);

        if (compressed.size > MAX_BASE64_SIZE) {
          // Try harder compression
          const moreCompressed = await compressImage(file, 600, 0.4);
          if (moreCompressed.size > MAX_BASE64_SIZE) {
            setUploadError('圖片太大，無法儲存。請選擇較小的圖片或降低解析度。');
            return null;
          }
          const base64 = await blobToBase64(moreCompressed);
          setProgress(100);
          return base64;
        }

        const base64 = await blobToBase64(compressed);
        setProgress(100);
        return base64;
      } catch (base64Error) {
        const msg = storageError.code === 'storage/unauthorized'
          ? '儲存空間權限不足，且備用方案也失敗了。請檢查 Firebase Storage 設定。'
          : '圖片上傳失敗，請稍後再試。';
        setUploadError(msg);
        return null;
      }
    } finally {
      setIsUploading(false);
    }
  }, [uid]);

  const clearError = useCallback(() => setUploadError(null), []);

  return { upload, isUploading, uploadError, progress, clearError };
}
