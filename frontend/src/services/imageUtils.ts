// file: src/services/imageUtils.ts

import type { DetectionRecord } from '@/types';

export class ImageUtils {
  /**
   * Get annotated image URL
   * Input: "20250621_143022/annotated/a1b2c3d4_solar_panel_001_annotated.jpg"
   * Output: "/processed/20250621_143022/annotated/a1b2c3d4_solar_panel_001_annotated.jpg"
   */
  static getAnnotatedUrl(path: string): string {
    return `/processed/${path}`;
  }

  /**
   * Get original image URL from annotated path
   * Replace /annotated/ with /original/ and _annotated with _original
   */
  static getOriginalUrl(annotatedPath: string): string {
    // Handle null/undefined safely
    if (!annotatedPath) {
      console.warn('getOriginalUrl: annotatedPath is null or undefined');
      return '/processed/placeholder.jpg'; // Return placeholder
    }

    const originalPath = annotatedPath
      .replace('/annotated/', '/original/')
      .replace('_annotated.jpg', '_original.jpg')
      .replace('_annotated.png', '_original.png');

    return `/processed/${originalPath}`;
  }

  /**
   * Get thumbnail URL
   */
  static getThumbnailUrl(path: string): string {
    return `/processed/${path}`;
  }

  /**
   * Check if image exists and is loadable
   */
  static async verifyImageExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get best available image (original → annotated → thumbnail)
   */
  static async getBestImageUrl(detection: DetectionRecord): Promise<string> {
    const originalUrl = this.getOriginalUrl(detection.annotated_image_path);
    const annotatedUrl = this.getAnnotatedUrl(detection.annotated_image_path);
    const thumbnailUrl = this.getThumbnailUrl(detection.thumbnail_path);

    // Try original first
    if (await this.verifyImageExists(originalUrl)) {
      return originalUrl;
    }

    // Fallback to annotated
    if (await this.verifyImageExists(annotatedUrl)) {
      return annotatedUrl;
    }

    // Last resort: thumbnail
    return thumbnailUrl;
  }

  /**
   * Preload image for smooth display
   */
  static preloadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
    });
  }

  /**
   * Format file size
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < 3) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Extract filename from path
   */
  static getFilename(path: string): string {
    return path.split('/').pop() || path;
  }
}