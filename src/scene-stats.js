/** Counts worlds created during this page, so travel checks can see leaks. */
export const sceneStats = {
  created: 0,
  released: 0,
  listeners: 0,
  renderers: 0,
};

export function trackWorldCreated() {
  sceneStats.created += 1;
  sceneStats.renderers += 1;
}

export function trackListeners(count) {
  sceneStats.listeners += count;
}

export function trackWorldReleased(listenerCount = 0) {
  sceneStats.released += 1;
  sceneStats.renderers = Math.max(0, sceneStats.renderers - 1);
  sceneStats.listeners = Math.max(0, sceneStats.listeners - listenerCount);
}
