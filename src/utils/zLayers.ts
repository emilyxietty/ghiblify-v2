/**
 * Z-index for body-portalled floating layers.
 *
 * These are set as *inline* styles rather than left to the stylesheets.
 * The CSS tier (`--z-portal`) says the same thing, but a portalled menu
 * has to beat surfaces from components that know nothing about it — the
 * widget edit panels, modals, the sidebar — and any one of those picking
 * up a higher value, or a stylesheet loading in an unlucky order, sends
 * the menu behind the thing that opened it. An inline value can't be
 * outranked by a rule.
 *
 * Sits above modals (100002) and the context menu (100100), below the
 * resize handle (100200) and tooltips (100300), which must stay on top
 * of everything.
 */
export const Z_FLOATING = 100150;
