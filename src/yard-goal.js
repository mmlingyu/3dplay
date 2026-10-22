/** Six plank cells inside the visible yard, plus the wider court the child can see. */

export const YARD_CELLS = Object.freeze([
  { x: -6, z: 5 },
  { x: -5, z: 5 },
  { x: -4, z: 5 },
  { x: -6, z: 6 },
  { x: -5, z: 6 },
  { x: -4, z: 6 },
]);

const MARKS = new Set(YARD_CELLS.map((cell) => `${cell.x},${cell.z}`));

export function yardPlankCount(blocks = []) {
  const seen = new Set();
  let extra = 0;
  for (const block of blocks) {
    if (block?.item !== 'plank' || block.y !== 0) continue;
    const x = Math.round(Number(block.x));
    const z = Math.round(Number(block.z));
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const key = `${x},${z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!MARKS.has(key) && x >= -8 && x <= -1 && z >= 3 && z <= 8) extra += 1;
  }
  const marked = [...MARKS].filter((key) => seen.has(key)).length;
  return Math.min(6, marked + extra);
}

export function yardCellFilled(blocks, x, z) {
  return (blocks || []).some((block) => block?.item === 'plank' && block.y === 0 && Math.round(block.x) === x && Math.round(block.z) === z);
}
