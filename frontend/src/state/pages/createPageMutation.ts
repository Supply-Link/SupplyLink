import { createAsyncThunk } from '@reduxjs/toolkit'
import { invalidatePages } from './events'
import type { PageName } from './types'

/** Keep refresh dependencies with the mutation, regardless of which view dispatches it. */
export function createPageMutation<Returned, Arg = void>(
  name: string,
  execute: (arg: Arg, context: { signal: AbortSignal }) => Promise<Returned>,
  affectedPages: PageName[],
) {
  return createAsyncThunk(name, async (arg: Arg, { dispatch, signal }) => {
    const result = await execute(arg, { signal })
    dispatch(invalidatePages(affectedPages))
    return result
  })
}
