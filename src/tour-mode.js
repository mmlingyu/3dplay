/** Parent tour. A separate save key so the child's valley is never opened. */

export const TOUR_STORAGE_KEY = 'yuanyuan-river-valley-v1-tour';
export const CHILD_STORAGE_KEY = 'yuanyuan-river-valley-v1';

export function isTour(search) {
  const raw = search !== undefined
    ? search
    : (typeof globalThis.location === 'object' && globalThis.location ? globalThis.location.search : '');
  const text = String(raw || '');
  const query = text.startsWith('?') || text === '' ? text : `?${text}`;
  try {
    return new URLSearchParams(query).get('tour') === '1';
  } catch {
    return false;
  }
}

/** Redirect every child-save key onto the tour key. The real key is never read or written. */
export function tourStorage(storage, tourKey = TOUR_STORAGE_KEY, childKey = CHILD_STORAGE_KEY) {
  const mapKey = (key) => {
    const name = String(key);
    if (name === childKey) return tourKey;
    const prefix = `${childKey}-`;
    if (name.startsWith(prefix)) return tourKey + name.slice(childKey.length);
    return name;
  };
  return {
    getItem(key) { return storage.getItem(mapKey(key)); },
    setItem(key, value) { return storage.setItem(mapKey(key), String(value)); },
    removeItem(key) { return storage.removeItem(mapKey(key)); },
  };
}
