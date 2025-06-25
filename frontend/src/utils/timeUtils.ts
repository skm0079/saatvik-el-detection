// File: src/utils/timeUtils.ts
// Utility functions for UTC to IST conversion

/**
 * Convert UTC date string to IST display
 * Database stores UTC, UI shows IST
 */
export class TimeUtils {
    /**
     * Convert UTC ISO string to IST formatted string
     * @param utcString - ISO string from database (UTC)
     * @returns Formatted IST string
     */
    static toIST(utcString: string): string {
        if (!utcString) return 'N/A';

        const utcDate = new Date(utcString);

        // Convert to IST (UTC+5:30)
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));

        return istDate.toLocaleString('en-IN', {
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
     * Convert UTC ISO string to IST date only
     */
    static toISTDate(utcString: string): string {
        if (!utcString) return 'N/A';

        const utcDate = new Date(utcString);
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));

        return istDate.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    /**
     * Convert UTC ISO string to IST time only
     */
    static toISTTime(utcString: string): string {
        if (!utcString) return 'N/A';

        const utcDate = new Date(utcString);
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));

        return istDate.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    /**
     * Get current IST time
     */
    static getCurrentIST(): string {
        const now = new Date();
        return now.toLocaleString('en-IN', {
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
     * Convert local datetime-local input to UTC for API
     * @param localDateTime - Value from datetime-local input
     * @returns UTC ISO string for API
     */
    static localToUTC(localDateTime: string): string {
        if (!localDateTime) return '';

        // Assume input is IST
        const localDate = new Date(localDateTime);
        // Subtract IST offset to get UTC
        const utcDate = new Date(localDate.getTime() - (5.5 * 60 * 60 * 1000));

        return utcDate.toISOString();
    }

    /**
     * Convert UTC to local datetime-local format for inputs
     * @param utcString - UTC ISO string
     * @returns Local datetime string for input
     */
    static utcToLocalInput(utcString: string): string {
        if (!utcString) return '';

        const utcDate = new Date(utcString);
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));

        // Format for datetime-local input (YYYY-MM-DDTHH:mm)
        return istDate.toISOString().slice(0, 16);
    }

    /**
     * Format relative time (e.g., "2 hours ago")
     */
    static getRelativeTime(utcString: string): string {
        if (!utcString) return 'Unknown';

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
    }
}