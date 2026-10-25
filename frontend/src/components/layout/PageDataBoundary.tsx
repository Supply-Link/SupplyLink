import { useEffect, type ReactNode } from 'react'
import type { PageName } from '../../state/pages/types'
import { useAppDispatch, useAppSelector } from '../../state/store'
import { pageLoaders } from '../../state/pages'
import { PageContext } from '../../state/pageContext'
import { WorkspaceSkeleton } from './WorkspaceSkeleton'
import { Button } from '../ui'

export function PageDataBoundary({ page, children }: { page: Exclude<PageName, 'shell'>; children: ReactNode }) {
  const dispatch = useAppDispatch()
  const { data, status, error } = useAppSelector((state) => state.pages[page])
  useEffect(() => { if (status === 'idle') void dispatch(pageLoaders[page]()) }, [dispatch, page, status])
  if (!data && status !== 'error') return <WorkspaceSkeleton />
  return <>
    {error && <div className="notice amber" role="alert">{error} <Button variant="secondary" onClick={() => void dispatch(pageLoaders[page]())}>Try again</Button></div>}
    {data && <PageContext.Provider value={data}>{children}</PageContext.Provider>}
  </>
}
