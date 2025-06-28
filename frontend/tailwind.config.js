/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    600: '#2563eb',
                    700: '#1d4ed8',
                },
                secondary: {
                    50: '#f8fafc',
                    200: '#e2e8f0',
                    600: '#475569',
                    900: '#0f172a',
                },
                success: { 600: '#059669' },
                warning: { 600: '#d97706' },
                error: { 600: '#dc2626' },
            },
        },
    },
    plugins: [],
}