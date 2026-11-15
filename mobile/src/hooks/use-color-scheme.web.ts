import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const noSubscription = () => () => {};

/**
 * To support static rendering, the web build reports "light" until it has
 * hydrated on the client, then the browser's real scheme. useSyncExternalStore
 * gives the server and the client their own value without an effect.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false
  );
  const colorScheme = useRNColorScheme();
  return hasHydrated ? colorScheme : 'light';
}
