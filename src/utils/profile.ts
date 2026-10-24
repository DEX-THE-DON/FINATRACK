import { getCookie, setCookie } from 'hono/cookie';

export type ProfileMode = 'RIDER' | 'TRADER' | 'SALARIED';

export interface ProfileMeta {
  mode: ProfileMode;
  label: string;
  tagline: string;
  icon: string;
  primaryRoute: string;
  themeColor: string;
  accentBadge: string;
}

export const PROFILES: Record<ProfileMode, ProfileMeta> = {
  RIDER: {
    mode: 'RIDER',
    label: 'Mobility & Rider',
    tagline: 'Kilometers, Fuel, CPK & Daily Shift Net Floors',
    icon: '🛵',
    primaryRoute: '/rider',
    themeColor: 'blue',
    accentBadge: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  TRADER: {
    mode: 'TRADER',
    label: 'Mama Mboga & Micro-Shop',
    tagline: 'Marikiti Soko Restock, Kanjo Fees & Daftari ya Mkopo',
    icon: '🥬',
    primaryRoute: '/trader',
    themeColor: 'emerald',
    accentBadge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  SALARIED: {
    mode: 'SALARIED',
    label: 'Salaried & Professional',
    tagline: 'Monthly Payday Waterfall & Salary Runway Pacing',
    icon: '💼',
    primaryRoute: '/salaried',
    themeColor: 'indigo',
    accentBadge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  },
};

export function getActiveProfile(c: any): ProfileMode {
  try {
    const raw = getCookie(c, 'finatrack_profile') || '';
    if (raw === 'TRADER' || raw === 'SALARIED' || raw === 'RIDER') {
      return raw as ProfileMode;
    }
  } catch (e) {}
  return 'RIDER'; // Default to existing rider experience
}

export function setActiveProfile(c: any, mode: ProfileMode): void {
  try {
    setCookie(c, 'finatrack_profile', mode, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}
