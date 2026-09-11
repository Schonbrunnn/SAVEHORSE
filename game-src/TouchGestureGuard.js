/** Keep Safari's page gestures separate from the game's multi-pointer input. */
export function installTouchGestureGuard(surface) {
  if (!surface) return () => {};
  const prevent = (event) => { if (event.cancelable) event.preventDefault(); };
  const onTouchMove = (event) => {
    if (event.touches.length > 1) prevent(event);
  };
  const onTouchEnd = (event) => {
    // Only combat controls use Pointer Events exclusively. Menu/dialogue/shop
    // buttons still need their normal touch-generated click to reach the UI.
    if (event.target?.closest?.('#touch-controls')) prevent(event);
  };
  const bindings = {
    gesturestart: prevent,
    gesturechange: prevent,
    gestureend: prevent,
    touchmove: onTouchMove,
    touchend: onTouchEnd,
    dblclick: prevent,
    dragstart: prevent,
  };
  Object.entries(bindings).forEach(([type, handler]) => surface.addEventListener(type, handler, { passive: false }));
  // Never stop propagation or clear InputManager: movement + jumping/attacking
  // must remain independent when several fingers are down at the same time.
  return () => Object.entries(bindings).forEach(([type, handler]) => surface.removeEventListener(type, handler));
}
