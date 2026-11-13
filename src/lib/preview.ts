/** Running inside the phone-preview frame: data arrives from the parent window and is never saved. */
export const IS_PREVIEW = typeof window !== 'undefined' && new URLSearchParams(location.search).get('preview') === 'phone' && window.parent !== window;
