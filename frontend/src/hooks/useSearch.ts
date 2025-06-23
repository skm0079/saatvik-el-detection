// file: src/hooks/useSearch.ts
import { useState, useEffect } from 'react';
import { useDebounce } from './useDebounce';

interface UseSearchOptions {
    minLength?: number;
    delay?: number;
    onSearch: (query: string) => void;
}

export function useSearch({
    minLength = 3,
    delay = 500,
    onSearch
}: UseSearchOptions) {
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedQuery = useDebounce(searchQuery, delay);

    useEffect(() => {
        // Auto-search when:
        // 1. Query has minimum length (3 chars)
        // 2. Query is empty (show all results)
        if (debouncedQuery.length >= minLength || debouncedQuery.length === 0) {
            onSearch(debouncedQuery);
        }
    }, [debouncedQuery, onSearch, minLength]);

    const isWaitingForMinLength = searchQuery.length > 0 && searchQuery.length < minLength;

    return {
        searchQuery,
        setSearchQuery,
        isWaitingForMinLength,
        debouncedQuery
    };
}