import { writable } from "svelte/store";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  let counter = 0;

  const add = (type: ToastType, message: string, duration = 5000) => {
    const id = `toast-${++counter}`;
    const toast: Toast = { id, type, message, duration };

    update((toasts) => [...toasts, toast]);

    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }

    return id;
  };

  const remove = (id: string) => {
    update((toasts) => toasts.filter((t) => t.id !== id));
  };

  const success = (message: string, duration?: number) => add("success", message, duration);
  const error = (message: string, duration?: number) => add("error", message, duration);
  const info = (message: string, duration?: number) => add("info", message, duration);
  const warning = (message: string, duration?: number) => add("warning", message, duration);

  return {
    subscribe,
    add,
    remove,
    success,
    error,
    info,
    warning
  };
}

export const toasts = createToastStore();
