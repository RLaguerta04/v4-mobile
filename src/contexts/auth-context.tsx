import { Ionicons } from '@expo/vector-icons';
import { createContext, useContext, useState } from 'react';

type IoniconName = keyof typeof Ionicons.glyphMap;

export type AppView = 'MediaWatch' | 'SharedView' | 'AdWatch';

// Fixed order matching the web app's dropdown — not alphabetical, so don't
// "clean it up" into MediaWatch/SharedView/AdWatch A-Z order.
export const APP_VIEWS: AppView[] = ['MediaWatch', 'SharedView', 'AdWatch'];

// Each platform's brand accent — applied to the logo, active nav state,
// selected tabs/filters, and primary buttons, so users always have a visual
// cue for which view they're in. Defaults to SharedView's blue wherever a
// view hasn't been chosen yet (e.g. the login screen).
export const VIEW_ACCENT_COLORS: Record<AppView, string> = {
  SharedView: '#2563EB',
  MediaWatch: '#E94F37',
  AdWatch: '#7C3AED',
};

// Each view's icon tells you what it monitors: MediaWatch = web articles,
// SharedView = social posts, AdWatch = ads. Shared by the view switcher sheet
// and the "Choose your view" selection screen so they never diverge.
export const VIEW_ICON: Record<AppView, IoniconName> = {
  MediaWatch: 'newspaper',
  SharedView: 'chatbubbles',
  AdWatch: 'easel',
};

interface AuthContextValue {
  isAuthenticated: boolean;
  // null = signed in but hasn't picked a view yet, so the post-login
  // selection screen shows instead of the app.
  activeView: AppView | null;
  accentColor: string;
  signIn: () => void;
  signOut: () => void;
  selectView: (view: AppView) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Starts signed in with a default view so existing screens/flows keep
  // working as before on a fresh app load — this is a prototype auth gate
  // for the sign-out → login → choose-view loop, not a real session that
  // needs to start logged out.
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeView, setActiveView] = useState<AppView | null>('SharedView');

  function signOut() {
    setIsAuthenticated(false);
    // Clearing this means the next sign-in re-prompts view selection,
    // rather than silently reusing whatever was picked last session.
    setActiveView(null);
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        activeView,
        accentColor: VIEW_ACCENT_COLORS[activeView ?? 'SharedView'],
        signIn: () => setIsAuthenticated(true),
        signOut,
        selectView: setActiveView,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
