// AdWatch's "Add to Tracker" state — the ad analogue of the MediaWatch tracker
// context (see mediawatch-tracker-context.tsx). Kept separate (own provider,
// own seed data) so the two article workspaces never share tracked activities,
// exactly as their datasets stay independent. `useArticleTracker()` selects the
// right one for the active view, so the shared article screens (detail reader,
// Activity Tracker) wire to whichever workspace is active.
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useMediaWatchTracker } from '@/contexts/mediawatch-tracker-context';
import { adwatchActivities } from '@/data/adwatch-ads';
import type { ActivityType, TrackerActivity, TrackerMatch } from '@/data/types';

export interface ArticleTrackerContextValue {
  activities: TrackerActivity[];
  /** How many activities currently list this ad/article title as a match. */
  countMatches: (title: string) => number;
  /** Add the match if absent, remove it if already present. */
  toggleMatch: (activityId: number, match: TrackerMatch) => void;
  /** "New activity from this item" — creates with the match pre-attached. */
  createActivityWithMatch: (title: string, type: ActivityType, match: TrackerMatch) => void;
}

const AdWatchTrackerContext = createContext<ArticleTrackerContextValue | null>(null);

export function AdWatchTrackerProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<TrackerActivity[]>(adwatchActivities);

  const countMatches = useCallback(
    (title: string) => activities.filter((a) => a.matches.some((m) => m.title === title)).length,
    [activities],
  );

  const toggleMatch = useCallback((activityId: number, match: TrackerMatch) => {
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== activityId) return a;
        const already = a.matches.some((m) => m.title === match.title);
        return {
          ...a,
          matches: already ? a.matches.filter((m) => m.title !== match.title) : [match, ...a.matches],
        };
      }),
    );
  }, []);

  const createActivityWithMatch = useCallback((title: string, type: ActivityType, match: TrackerMatch) => {
    setActivities((prev) => [
      { id: 2000 + prev.length, title, type, date: match.date, description: '', matches: [match] },
      ...prev,
    ]);
  }, []);

  const value = useMemo(
    () => ({ activities, countMatches, toggleMatch, createActivityWithMatch }),
    [activities, countMatches, toggleMatch, createActivityWithMatch],
  );

  return <AdWatchTrackerContext.Provider value={value}>{children}</AdWatchTrackerContext.Provider>;
}

export function useAdWatchTracker(): ArticleTrackerContextValue {
  const ctx = useContext(AdWatchTrackerContext);
  if (!ctx) throw new Error('useAdWatchTracker must be used within an AdWatchTrackerProvider');
  return ctx;
}

/**
 * The tracker for the active article workspace — AdWatch when that view is
 * active, MediaWatch otherwise. Both providers are mounted, so both hooks run
 * unconditionally and only the result is switched.
 */
export function useArticleTracker(): ArticleTrackerContextValue {
  const { activeView } = useAuth();
  const mediaWatch = useMediaWatchTracker();
  const adWatch = useAdWatchTracker();
  return activeView === 'AdWatch' ? adWatch : mediaWatch;
}
