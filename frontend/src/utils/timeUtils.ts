// File: frontend/src/utils/timeUtils.ts

export class TimeUtils {
    // IST offset in milliseconds (UTC + 5:30)
    private static readonly IST_OFFSET = 5.5 * 60 * 60 * 1000;

    /**
     * Convert UTC ISO string to IST formatted string
     * @param utcString - ISO string from database (UTC)
     * @returns Formatted IST string
     */
    static toIST(utcString: string): string {
        if (!utcString) return 'N/A';

        try {
            const utcDate = new Date(utcString);

            if (isNaN(utcDate.getTime())) {
                console.warn('Invalid UTC date string:', utcString);
                return 'Invalid Date';
            }

            // Create IST date by adding offset
            const istDate = new Date(utcDate.getTime() + TimeUtils.IST_OFFSET);

            return istDate.toLocaleString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'UTC' // Force UTC formatting since we already applied offset
            });
        } catch (error) {
            console.error('Error converting to IST:', error);
            return 'Error';
        }
    }

    /**
     * Convert UTC ISO string to IST date only
     */
    static toISTDate(utcString: string): string {
        if (!utcString) return 'N/A';

        try {
            const utcDate = new Date(utcString);

            if (isNaN(utcDate.getTime())) {
                return 'Invalid Date';
            }

            const istDate = new Date(utcDate.getTime() + TimeUtils.IST_OFFSET);

            return istDate.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                timeZone: 'UTC' // Force UTC formatting since we already applied offset
            });
        } catch (error) {
            console.error('Error converting to IST date:', error);
            return 'Error';
        }
    }

    /**
     * Convert UTC ISO string to IST time only
     */
    static toISTTime(utcString: string): string {
        if (!utcString) return 'N/A';

        try {
            const utcDate = new Date(utcString);

            if (isNaN(utcDate.getTime())) {
                return 'Invalid Time';
            }

            const istDate = new Date(utcDate.getTime() + TimeUtils.IST_OFFSET);

            return istDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'UTC' // Force UTC formatting since we already applied offset
            });
        } catch (error) {
            console.error('Error converting to IST time:', error);
            return 'Error';
        }
    }

    /**
     * Get current IST time - FIXED VERSION
     */
    static getCurrentIST(): string {
        // Method 1: Using built-in timezone support (RECOMMENDED)
        return new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    /**
     * Alternative method for getCurrentIST using manual offset calculation
     */
    static getCurrentISTManual(): string {
        const now = new Date();
        // Get UTC time in milliseconds
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        // Add IST offset to UTC time
        const istTime = new Date(utcTime + TimeUtils.IST_OFFSET);

        return istTime.toLocaleString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'UTC' // Important: use UTC since we manually calculated IST
        });
    }

    /**
     * Convert local datetime-local input to UTC for API
     * @param localDateTime - Value from datetime-local input (treated as IST)
     * @returns UTC ISO string for API
     */
    static localToUTC(localDateTime: string): string {
        if (!localDateTime) return '';

        try {
            // Parse as local time (assuming IST input)
            const localDate = new Date(localDateTime);

            if (isNaN(localDate.getTime())) {
                return '';
            }

            // Subtract IST offset to get UTC
            const utcDate = new Date(localDate.getTime() - TimeUtils.IST_OFFSET);

            return utcDate.toISOString();
        } catch (error) {
            console.error('Error converting local to UTC:', error);
            return '';
        }
    }

    /**
     * Convert UTC to local datetime-local format for inputs
     * @param utcString - UTC ISO string
     * @returns Local datetime string for input (IST)
     */
    static utcToLocalInput(utcString: string): string {
        if (!utcString) return '';

        try {
            const utcDate = new Date(utcString);

            if (isNaN(utcDate.getTime())) {
                return '';
            }

            const istDate = new Date(utcDate.getTime() + TimeUtils.IST_OFFSET);

            // Format for datetime-local input (YYYY-MM-DDTHH:mm)
            const year = istDate.getFullYear();
            const month = String(istDate.getMonth() + 1).padStart(2, '0');
            const day = String(istDate.getDate()).padStart(2, '0');
            const hours = String(istDate.getHours()).padStart(2, '0');
            const minutes = String(istDate.getMinutes()).padStart(2, '0');

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (error) {
            console.error('Error converting UTC to local input:', error);
            return '';
        }
    }

    /**
     * Format relative time (e.g., "2 hours ago")
     */
    static getRelativeTime(utcString: string): string {
        if (!utcString) return 'Unknown';

        try {
            const utcDate = new Date(utcString);
            const now = new Date();
            const diffMs = now.getTime() - utcDate.getTime();
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMinutes < 1) return 'Just now';
            if (diffMinutes < 60) return `${diffMinutes} min ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;

            // For older dates, show IST date
            return TimeUtils.toISTDate(utcString);
        } catch (error) {
            console.error('Error getting relative time:', error);
            return 'Unknown';
        }
    }

    /**
     * Get today's date range in UTC for API queries
     * @returns Object with start and end of today in UTC
     */
    static getTodayRangeUTC(): { start: string; end: string } {
        // Get current time in IST using proper timezone
        const now = new Date();
        const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

        // Get start of day in IST (00:00:00)
        const istStartOfDay = new Date(istNow);
        istStartOfDay.setHours(0, 0, 0, 0);

        // Get end of day in IST (23:59:59.999)
        const istEndOfDay = new Date(istNow);
        istEndOfDay.setHours(23, 59, 59, 999);

        // Convert IST times to UTC for API
        const utcStart = new Date(istStartOfDay.getTime() - TimeUtils.IST_OFFSET);
        const utcEnd = new Date(istEndOfDay.getTime() - TimeUtils.IST_OFFSET);

        return {
            start: utcStart.toISOString(),
            end: utcEnd.toISOString()
        };
    }

    /**
     * Debug method to show different time representations
     */
    static debugCurrentTime(): void {
        const now = new Date();
        console.log('=== Time Debug Info ===');
        console.log('Raw Date object:', now);
        console.log('UTC ISO string:', now.toISOString());
        console.log('Local string (browser):', now.toLocaleString());
        console.log('IST (Asia/Kolkata):', now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('Manual IST calculation:', TimeUtils.getCurrentISTManual());
        console.log('Fixed getCurrentIST():', TimeUtils.getCurrentIST());
        console.log('======================');
    }
}