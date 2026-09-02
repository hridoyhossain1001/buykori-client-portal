/**
 * Container for the Setup health page.
 *
 * It owns nothing but two derivations, because `App.tsx` already owns every
 * request this page makes (`GET /api/suggestions` in the batched load, plus
 * `/suggestions/ai-review`, `/suggestions/toggle-resolve` and
 * `/suggestions/dismiss`) and passes the callbacks down:
 *
 *  - a defensive de-dupe, so two identical checks cannot render as two rows,
 *  - the local time of the last completed re-check, so the panel can say when
 *    the list was last confirmed instead of implying it is live.
 *
 * All presentation lives in `setupHealth/SetupHealthWorkspace.tsx`.
 */
import React from 'react';
import { Suggestion } from '../types';
import { SetupHealthWorkspace } from './setupHealth/SetupHealthWorkspace';

interface SuggestionsViewProps {
  suggestions: Suggestion[];
  optScore: number;
  aiReviewing: boolean;
  handleAiReview: () => Promise<void>;
  toggleResolveSuggestion: (id: string, isNowResolved: boolean) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  /** Suggestion IDs with a resolve/dismiss request currently in flight. */
  suggestionBusyIds: string[];
}

export function SuggestionsView({
  suggestions,
  optScore,
  aiReviewing,
  handleAiReview,
  toggleResolveSuggestion,
  dismissSuggestion,
  suggestionBusyIds,
}: SuggestionsViewProps) {
  const uniqueSuggestions = React.useMemo(
    () =>
      Array.from(
        suggestions.reduce((map, suggestion) => {
          const key = [
            suggestion.platform || 'global',
            suggestion.title,
            suggestion.explanation,
            suggestion.fixAction,
          ].map(value => String(value || '').trim().toLowerCase()).join('|') || suggestion.id;
          if (!map.has(key)) map.set(key, suggestion);
          return map;
        }, new Map<string, Suggestion>()).values(),
      ),
    [suggestions],
  );

  // "Last checked" is only claimed for a re-check that actually finished here.
  // Before that the honest statement is that the checks ran on page load, which
  // is what the workspace says when this is null.
  const [lastCheckedAt, setLastCheckedAt] = React.useState<string | null>(null);
  const wasReviewing = React.useRef(aiReviewing);

  React.useEffect(() => {
    if (wasReviewing.current && !aiReviewing) {
      setLastCheckedAt(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
    }
    wasReviewing.current = aiReviewing;
  }, [aiReviewing]);

  return (
    <SetupHealthWorkspace
      checks={uniqueSuggestions}
      optScore={optScore}
      aiReviewing={aiReviewing}
      handleAiReview={handleAiReview}
      toggleResolveSuggestion={toggleResolveSuggestion}
      dismissSuggestion={dismissSuggestion}
      suggestionBusyIds={suggestionBusyIds}
      lastCheckedAt={lastCheckedAt}
    />
  );
}
