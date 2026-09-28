import { useEffect } from 'react'

/**
 * Whether the open editor holds changes that have not been saved.
 *
 * Module state, not context: the one editor on screen writes it, and the
 * shell's nav links read it at click time. The router in App.tsx is the
 * declarative BrowserRouter, which has no navigation blocker, so the links
 * ask for themselves.
 */
let dirty = false

/** For a link's onClick: true to go ahead, false to stay. */
export function confirmLeave(): boolean {
  return !dirty || window.confirm('You have unsaved changes. Leave without saving?')
}

/** Registers the editor's dirty state, and guards tab close / reload with it. */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    dirty = isDirty
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      dirty = false
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [isDirty])
}
