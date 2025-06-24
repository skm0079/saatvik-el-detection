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
   * Get original image URL from annotated image path
   * 
   * FILE PATTERN ANALYSIS:
   * - Source files (in ./source/): "detection_id_originalfilename.jpg"
   *   Example: "04978bc4-3fba-4ad6-92d8-0b7216e14224_SGE0224THC2833064.jpg"
   * 
   * - Annotated files (in ./processed/timestamp/annotated/): "detection_id_originalfilename_annotated.jpg"
   *   Example: "04978bc4-3fba-4ad6-92d8-0b7216e14224_SGE0224THC2833064_annotated.jpg"
   * 
   * TRANSFORMATION LOGIC:
   * Input:  "20250624_082116/annotated/detection_id_filename_annotated.jpg"
   * Output: "/source/detection_id_filename.jpg"
   */
  static getOriginalUrl(annotatedPath: string): string {
    // STEP 1: Null/undefined safety check
    if (!annotatedPath) {
      console.warn('getOriginalUrl: annotatedPath is null or undefined');
      return '/source/placeholder.jpg'; // Fallback for broken data
    }

    // STEP 2: Extract filename from full path
    // Input: "20250624_082116/annotated/detection_id_filename_annotated.jpg"
    // Split by '/' and get last part: "detection_id_filename_annotated.jpg"
    const filename = annotatedPath.split('/').pop();

    // STEP 3: Validate filename extraction
    if (!filename) {
      console.warn('getOriginalUrl: Could not extract filename from path:', annotatedPath);
      return '/source/placeholder.jpg'; // Fallback for malformed paths
    }

    // STEP 4: Transform annotated filename to source filename
    // Remove "_annotated" suffix to match source file naming
    // "detection_id_filename_annotated.jpg" → "detection_id_filename.jpg"
    // "detection_id_filename_annotated.png" → "detection_id_filename.png"
    const originalFilename = filename
      .replace('_annotated.jpg', '.jpg')  // Handle JPG files
      .replace('_annotated.png', '.png'); // Handle PNG files

    // STEP 5: Debug logging (remove in production)
    console.log('Input annotated path:', annotatedPath);
    console.log('Extracted filename:', filename);
    console.log('Generated original filename:', originalFilename);

    // STEP 6: Construct final static URL
    // Static route "/source" maps to ./source/ folder in project root
    const finalUrl = `/source/${originalFilename}`;
    console.log('Final original URL:', finalUrl);

    return finalUrl;
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