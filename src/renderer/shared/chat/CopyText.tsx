import { createContext, useContext } from 'react'

// The copy action differs per renderer (the overlay and management windows
// expose different bridges), so shared chat components read it from context.
const CopyTextContext = createContext<(text: string) => void>(() => {})

export const CopyTextProvider = CopyTextContext.Provider
export const useCopyText = (): ((text: string) => void) => useContext(CopyTextContext)
