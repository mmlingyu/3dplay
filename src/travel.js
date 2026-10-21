/** A short, skippable departure. Pause and a hidden page hold the timer. */

export function createCutscene(kind, seconds = 3) {
  return {
    kind,
    seconds,
    elapsed: 0,
    done: false,
    tick(dt, { paused = false, hidden = false } = {}) {
      if (this.done || paused || hidden) return this.done;
      this.elapsed += Math.max(0, Number(dt) || 0);
      if (this.elapsed >= this.seconds) this.done = true;
      return this.done;
    },
    skip() {
      this.done = true;
      return true;
    },
    progress() {
      return Math.min(1, this.elapsed / this.seconds);
    },
  };
}
