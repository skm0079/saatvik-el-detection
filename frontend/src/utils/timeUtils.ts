// File: frontend/src/utils/timeUtils.ts - SIMPLE FIX

export class TimeUtils {
    /**
     * Convert UTC ISO string to IST formatted string
     */
    static toIST(utcString: string): string {
        if (!utcString) return 'N/A';
        try {
            const utcDate = new Date(utcString);
            if (isNaN(utcDate.getTime())) return 'Invalid Date';

            return utcDate.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        } catch (error) {
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
            if (isNaN(utcDate.getTime())) return 'Invalid Date';

            return utcDate.toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (error) {
            return 'Error';
        }
    }

    /**
     * Get current IST time
     */
    static getCurrentIST(): string {
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
     * Get today's date range in UTC for API queries - FIXED
     */
    static getTodayRangeUTC(): { start: string; end: string } {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        const startIST = new Date(`${today}T00:00:00+05:30`);
        const endIST = new Date(`${today}T23:59:59+05:30`);

        return {
            start: startIST.toISOString(),
            end: endIST.toISOString()
        };
    }

    /**
     * Convert IST datetime-local input to UTC for API
     */
    static localToUTC(localDateTime: string): string {
        if (!localDateTime) return '';
        try {
            const istDate = new Date(`${localDateTime}+05:30`);
            if (isNaN(istDate.getTime())) return '';
            return istDate.toISOString();
        } catch (error) {
            return '';
        }
    }

    /**
     * Convert UTC to local datetime-local format for inputs
     */
    static utcToLocalInput(utcString: string): string {
        if (!utcString) return '';
        try {
            const utcDate = new Date(utcString);
            if (isNaN(utcDate.getTime())) return '';

            const istTime = utcDate.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
            return istTime.replace(' ', 'T').slice(0, 16);
        } catch (error) {
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

            return TimeUtils.toISTDate(utcString);
        } catch (error) {
            return 'Unknown';
        }
    }
}