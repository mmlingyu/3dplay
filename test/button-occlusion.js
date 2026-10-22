/** Visible button centers must hit that button, and no other panel may cover them. */

export function buttonBlockers() {
  const overlays = [
    '#balloon-hud', '#bounce-hud', '#land-question', '#tour-guide', '#story-banner', '#story-talk',
    '#story-home', '#vista-card', '#tutor-card', '#context-hint', '#letter-card', '#mei-letter',
    '#travel-cutscene', '#holo-transition', '#star-cutscene', '#xing-sheet', '#holo-panel', '#ri-sheet',
    '#vista-stamp', '#focus-exit', '#story-festival', '#overlay-more', '#toast-root', '.minimap-card',
    '#ri-actions', '#mei-actions', '#xing-actions', '#holo-bar', '#travel-go', '#travel-go-mei',
    '#travel-home', '#wish-card',
  ].flatMap((selector) => [...document.querySelectorAll(selector)]);
  const visible = (el) => {
    if (!el || el.hidden || el.closest('[hidden]') || el.classList.contains('overlay-parked')) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= 8 && rect.height >= 8;
  };
  const clip = (el) => {
    const rect = el.getBoundingClientRect();
    let box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    let node = el.parentElement;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      if (/(auto|scroll|hidden)/.test(`${style.overflow}${style.overflowY}`)) {
        const parent = node.getBoundingClientRect();
        box = {
          left: Math.max(box.left, parent.left),
          top: Math.max(box.top, parent.top),
          right: Math.min(box.right, parent.right),
          bottom: Math.min(box.bottom, parent.bottom),
        };
      }
      node = node.parentElement;
    }
    return box;
  };
  const blocked = [];
  for (const button of document.querySelectorAll('button')) {
    if (!visible(button)) continue;
    const box = clip(button);
    if (box.right - box.left < 20 || box.bottom - box.top < 20) continue;
    const cx = (box.left + box.right) / 2;
    const cy = (box.top + box.bottom) / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
    const hit = document.elementFromPoint(cx, cy);
    const hitOk = Boolean(hit && (hit === button || button.contains(hit)));
    if (!hitOk && button.classList.contains('world-label') && hit?.closest?.('button, [role="dialog"]')) continue;
    const control = button.closest('#balloon-hud, #bounce-hud, .bottom-dock, .minimap-card, .topbar, .action-controls, #travel-go, #travel-go-mei, #travel-home, #ri-actions, #mei-actions, #xing-actions, #holo-bar, #overlay-more');
    const covers = [];
    if (control) {
      for (const el of overlays) {
        if (!visible(el) || el === button || el.contains(button) || button.contains(el)) continue;
        const rect = el.getBoundingClientRect();
        if (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom) {
          covers.push(el.id || el.className?.toString?.().slice(0, 40) || el.tagName);
        }
      }
    }
    if (!hitOk || covers.length) {
      const name = button.id || button.getAttribute('aria-label') || button.textContent.trim().slice(0, 16) || 'button';
      blocked.push(`${name} → ${covers.join('+') || hit?.id || hit?.className || 'miss'}`);
    }
  }
  return blocked;
}
