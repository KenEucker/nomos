import { writable } from "svelte/store"

export type ConfirmDialogOptions = {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
}

type ConfirmDialogState = ConfirmDialogOptions & {
  open: boolean
  resolve?: (value: boolean) => void
  token?: string
}

let nextDialogId = 0

function createConfirmDialogStore() {
  const { subscribe, update, set } = writable<ConfirmDialogState>({
    open: false,
    title: "",
  })

  let currentState: ConfirmDialogState = {
    open: false,
    title: "",
  }

  subscribe((state) => {
    currentState = state
  })

  const show = (options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const dialogToken = `confirm-${++nextDialogId}-${Date.now()}`
      const timeout = setTimeout(() => {
        update((state) => {
          if (state.token !== dialogToken) return state
          if (state.resolve) state.resolve(false)
          return { ...state, open: false, resolve: undefined, token: undefined }
        })
      }, 30000)
      const wrappedResolve = (value: boolean) => {
        clearTimeout(timeout)
        resolve(value)
      }
      set({
        ...options,
        open: true,
        resolve: wrappedResolve,
        token: dialogToken,
      })
    })
  }

  const close = (confirmed: boolean) => {
    update((state) => {
      if (state.resolve) {
        state.resolve(confirmed)
      }
      return {
        ...state,
        open: false,
        resolve: undefined,
        token: undefined,
      }
    })
  }

  const get = () => currentState

  return {
    subscribe,
    show,
    close,
    get,
  }
}

export const confirmDialogStore = createConfirmDialogStore()

export async function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return confirmDialogStore.show(options)
}
