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
   * Get original image URL from detection object
   * 
   * FILE PATTERN ANALYSIS:
   * - Source files (in ./source/): "detection_id_machine_id_originalfilename.jpg"
   *   Example: "cd5a46e7-e0ab-4551-9f4d-5744a641d6ce_Factory_Line_1_SGE0225THC1774929.jpg"
   * 
   * - Annotated files (in ./processed/timestamp/annotated/): "detection_id_originalfilename_annotated.jpg"
   *   Example: "cd5a46e7-e0ab-4551-9f4d-5744a641d6ce_SGE0225THC1774929_annotated.jpg"
   * 
   * TRANSFORMATION LOGIC:
   * Input:  "20250628_072712/annotated/detection_id_filename_annotated.jpg"
   * Output: "/source/detection_id_machine_id_filename.jpg"
   * 
   * NOTE: Machine ID is inserted between detection_id and original filename
   * Machine ID spaces are converted to underscores for filename compatibility
   * 
   * @param {Object} detection - The detection object containing annotated_image_path, detection_id, machine_id, etc.
   * @param {string} [machineId] - Optional machine ID override
   * @returns {string} - The original image URL path
   */
  static getOriginalUrl(detection: any, machineId = null) {
    // Safety check
    if (!detection?.annotated_image_path) {
      console.warn('getOriginalUrl: No annotated_image_path found');
      return '/source/placeholder.jpg';
    }

    // Extract filename from path
    const filename = detection.annotated_image_path.split('/').pop();
    if (!filename) {
      console.warn('getOriginalUrl: Could not extract filename');
      return '/source/placeholder.jpg';
    }

    // Remove _annotated suffix
    let originalFilename = filename
      .replace('_annotated.jpg', '.jpg')
      .replace('_annotated.png', '.png')
      .replace('_annotated.jpeg', '.jpeg');

    // Get machine ID - use override or from detection object
    const finalMachineId = machineId || detection.machine_id;

    // Convert spaces to underscores for filename compatibility
    const cleanMachineId = finalMachineId ? finalMachineId.replace(/\s+/g, '_') : null;

    // If we have machine ID and it's not already in filename, insert it
    if (cleanMachineId && !originalFilename.includes(cleanMachineId)) {
      const parts = originalFilename.split('_');
      if (parts.length >= 2) {
        // Insert machine ID after detection_id (first part)
        originalFilename = [parts[0], cleanMachineId, ...parts.slice(1)].join('_');
        console.log('Inserted machine ID into filename:', originalFilename);
      }
    }

    const finalUrl = `/source/${originalFilename}`;

    console.log('Generated original URL:', finalUrl);
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