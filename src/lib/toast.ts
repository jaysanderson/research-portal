// Tiny event-based toast helper. Call toast(...) from anywhere; <Toaster/> renders it.
export interface ToastMsg { id: number; text: string; kind: 'success' | 'error' | 'info' }
let _id = 0;
export function toast(text: string, kind: ToastMsg['kind'] = 'info') {
  window.dispatchEvent(new CustomEvent('rp-toast', { detail: { id: ++_id, text, kind } }));
}
