'use client';

import { useState, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveSearchProps {
  searchQuery: string;
  onSearch?: (query: string) => void;
}

const BraveSearch = memo(function BraveSearch({ searchQuery, onSearch }: BraveSearchProps) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setLastSearchQuery(query);
    
    try {
      const response = await fetch('/api/brave-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: query,
          count: 6
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    performSearch(searchQuery);
    onSearch?.(searchQuery);
  }, [searchQuery, onSearch, performSearch]);

  return (
    <div className="w-full">
      {/* Search Button - Minimalist Design */}
      <div className="mb-4">
        <Button
          onClick={handleSearch}
          disabled={!searchQuery.trim() || isSearching}
          variant="outline"
          className="group relative bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 shadow-sm hover:shadow-md"
        >
          <div className="flex items-center gap-2">
            {isSearching ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="text-blue-600 dark:text-blue-400"
              >
                🔍
              </motion.div>
            ) : (
              <span className="text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                🔍
              </span>
            )}
            <span className="font-medium">
              {isSearching ? 'Searching...' : 'Search Web'}
            </span>
          </div>
        </Button>
      </div>

      {/* Search Results Display */}
      <AnimatePresence>
        {(searchResults.length > 0 || error || (isSearching && lastSearchQuery)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-xl text-blue-600 dark:text-blue-400">🔍</span>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Search Results</h3>
                  {lastSearchQuery && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      "{lastSearchQuery}"
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="p-6 text-center">
                <div className="text-red-500 text-lg mb-2">⚠️</div>
                <p className="text-red-500">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {isSearching && (
              <div className="p-6 text-center text-gray-500">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="text-3xl mb-2"
                >
                  🔍
                </motion.div>
                <p>Searching the web...</p>
              </div>
            )}

            {/* Results */}
            {!isSearching && searchResults.length > 0 && (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {searchResults.map((result, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400"
                    onClick={() => window.open(result.url, '_blank')}
                  >
                    <h4 className="font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-1 text-lg">
                      {result.title}
                    </h4>
                    <p className="text-sm text-green-600 dark:text-green-400 mb-2 font-medium">
                      🌐 {result.url}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {result.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isSearching && searchResults.length === 0 && lastSearchQuery && !error && (
              <div className="p-6 text-center text-gray-500">
                <div className="text-3xl mb-2">🔍</div>
                <p>No results found for "{lastSearchQuery}"</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )}

            {/* Footer */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-xs text-gray-500">
                Powered by Brave Search API • Privacy-focused web search
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default BraveSearch;