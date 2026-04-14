'use client'

import { createContext, useContext, useState } from 'react'

interface HelpSearchState {
  query: string
  setQuery: (q: string) => void
}

const HelpSearchContext = createContext<HelpSearchState>({
  query: '',
  setQuery: () => {},
})

export function useHelpSearch() {
  return useContext(HelpSearchContext)
}

export function HelpSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  return (
    <HelpSearchContext value={{ query, setQuery }}>
      {children}
    </HelpSearchContext>
  )
}
