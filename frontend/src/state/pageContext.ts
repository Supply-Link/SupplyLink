import { createContext, useContext } from 'react'
import type { PageName, PagePayloads } from './pages/types'

export const PageContext = createContext<PagePayloads[PageName] | null>(null)
export function usePageData<P extends PageName>() {
  const value = useContext(PageContext)
  if (!value) throw new Error('Page data must be loaded before rendering its view.')
  return value as PagePayloads[P]
}
