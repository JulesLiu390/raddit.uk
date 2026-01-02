import { useState, useEffect, useRef, useCallback } from 'react';
import { searchUsers } from '../api';

export const useMention = () => {
  const [query, setQuery] = useState(null);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (query === null) {
      setResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchUsers(query);
        setResults(res);
      } catch (err) {
        console.error('Search users failed', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const checkMention = useCallback((text) => {
    // Match @username at the end, allowing start of string or whitespace before it
    const match = text && text.match(/(?:^|\s)@(\S*)$/);
    if (match) {
      setQuery(match[1]);
      return true;
    } else {
      setQuery(null);
      setResults([]);
      return false;
    }
  }, []);

  const insertMention = useCallback((user, text, setText) => {
    const newText = text.replace(/(?:^|\s)@(\S*)$/, (match) => {
        const prefix = match.startsWith(' ') ? ' ' : '';
        const id = user.googleId || user.id;
        // Insert Markdown link format
        return `${prefix}[@${user.name}](/profile/${id}) `; 
    });
    setText(newText);
    setQuery(null);
    setResults([]);
  }, []);

  return {
    query,
    results,
    isSearching,
    checkMention,
    insertMention,
    setQuery,
    setResults
  };
};
