import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { TrackerActivity } from '@/data/types';

interface TrackerContextValue {
  // Activities the user has created via "+ New activity". Kept in a context so
  // they survive the Activity tab unmounting/remounting during navigation.
  userActivities: TrackerActivity[];
  addActivity: (activity: Omit<TrackerActivity, 'id'>) => void;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [userActivities, setUserActivities] = useState<TrackerActivity[]>([]);

  const addActivity = useCallback((activity: Omit<TrackerActivity, 'id'>) => {
    // Offset ids past the authored set (1–7) so they never collide.
    setUserActivities((prev) => [{ ...activity, id: 1000 + prev.length }, ...prev]);
  }, []);

  const value = useMemo(() => ({ userActivities, addActivity }), [userActivities, addActivity]);

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTrackerActivities() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTrackerActivities must be used within a TrackerProvider');
  return ctx;
}
