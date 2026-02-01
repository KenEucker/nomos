import { toast as sonnerToast } from "svelte-sonner";

export type ToastType = "success" | "error" | "info" | "warning";

/** @deprecated Use toasts.success etc. for store-based toasts if needed */
export const toasts = {
  subscribe: () => () => {},
  add: () => "",
  remove: () => {},
  success: (msg: string) => sonnerToast.success(msg),
  error: (msg: string) => sonnerToast.error(msg),
  info: (msg: string) => sonnerToast.info(msg),
  warning: (msg: string) => sonnerToast.warning(msg)
};

export const notify = (message: string, type: ToastType = "info") => {
  switch (type) {
    case "success":
      return sonnerToast.success(message);
    case "error":
      return sonnerToast.error(message);
    case "warning":
      return sonnerToast.warning(message);
    default:
      return sonnerToast.info(message);
  }
};

export const toastError = (title: string, message: string) => {
  const combined = title ? `${title}: ${message}` : message;
  sonnerToast.error(combined);
};
