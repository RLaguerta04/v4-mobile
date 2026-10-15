// MediaWatch's "Add to Tracker" state — the article analogue of SharedView's
// tracker-context.tsx, kept separate (own file, own provider) rather than
// extending the shared TrackerContext, since that context's `userActivities`
// is workspace-agnostic by design (bleeds into both feeds) while this one
// needs to mutate the MediaWatch-specific authored activities themselves
// (toggle an article's membership in an existing activity, web parity:
// _atArtBtn / atTrackToggle in the reference app.js).
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { mediawatchActivities } from '@/data/mediawatch-articles';
import type { ActivityType, TrackerActivity, TrackerMatch } from '@/data/types';

interface MediaWatchTrackerContextValue {
  activities: TrackerActivity[];
  /** How many activities currently list this article title as a match. */
  countMatches: (title: string) => number;
  /** Add the match if absent, remove it if already present. */
  toggleMatch: (activityId: number, match: TrackerMatch) => void;
  /** "New activity from this article" — creates with the match pre-attached. */
  createActivityWithMatch: (title: string, type: ActivityType, match: TrackerMatch) => void;
}

const MediaWatchTrackerContext = createContext<MediaWatchTrackerContextValue | null>(null);

export function MediaWatchTrackerProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<TrackerActivity[]>(mediawatchActivities);

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
      { id: 1000 + prev.length, title, type, date: match.date, description: '', matches: [match] },
      ...prev,
    ]);
  }, []);

  const value = useMemo(
    () => ({ activities, countMatches, toggleMatch, createActivityWithMatch }),
    [activities, countMatches, toggleMatch, createActivityWithMatch],
  );

  return <MediaWatchTrackerContext.Provider value={value}>{children}</MediaWatchTrackerContext.Provider>;
}

export function useMediaWatchTracker() {
  const ctx = useContext(MediaWatchTrackerContext);
  if (!ctx) throw new Error('useMediaWatchTracker must be used within a MediaWatchTrackerProvider');
  return ctx;
}
