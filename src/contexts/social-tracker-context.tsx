// SharedView's "Add to Tracker" state — the social-post analogue of
// mediawatch-tracker-context.tsx. Kept as its own provider (not folded into
// tracker-context.tsx, whose `userActivities` is workspace-agnostic and bleeds
// into both feeds) because this one owns the SharedView-specific authored
// social activities and mutates an individual post's membership in them.
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { trackerActivities } from '@/data/sample-data';
import type { ActivityType, TrackerActivity, TrackerMatch } from '@/data/types';

interface SocialTrackerContextValue {
  activities: TrackerActivity[];
  /** How many activities currently list this post (keyed on its text) as a match. */
  countMatches: (title: string) => number;
  /** Add the match if absent, remove it if already present. */
  toggleMatch: (activityId: number, match: TrackerMatch) => void;
  /** "New activity from this post" — creates with the match pre-attached. */
  createActivityWithMatch: (title: string, type: ActivityType, match: TrackerMatch) => void;
}

const SocialTrackerContext = createContext<SocialTrackerContextValue | null>(null);

export function SocialTrackerProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<TrackerActivity[]>(trackerActivities);

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
    // Offset ids past the authored social set (and the MediaWatch 1000+ range)
    // so the two workspaces' activities never collide in the shared Activity tab.
    setActivities((prev) => [
      { id: 2000 + prev.length, title, type, date: match.date, description: '', matches: [match] },
      ...prev,
    ]);
  }, []);

  const value = useMemo(
    () => ({ activities, countMatches, toggleMatch, createActivityWithMatch }),
    [activities, countMatches, toggleMatch, createActivityWithMatch],
  );

  return <SocialTrackerContext.Provider value={value}>{children}</SocialTrackerContext.Provider>;
}

export function useSocialTracker() {
  const ctx = useContext(SocialTrackerContext);
  if (!ctx) throw new Error('useSocialTracker must be used within a SocialTrackerProvider');
  return ctx;
}
