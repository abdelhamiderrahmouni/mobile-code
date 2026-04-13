import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, STORAGE_KEY } from './constants';
import { PersistedState } from './types';

const EMPTY_STATE: PersistedState = {
  sessions: [],
  favoriteModelIds: [],
  settings: DEFAULT_SETTINGS,
};

export async function loadState(): Promise<PersistedState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return EMPTY_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      favoriteModelIds: Array.isArray(parsed.favoriteModelIds)
        ? parsed.favoriteModelIds
        : [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
