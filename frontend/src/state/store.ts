import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux'
import auth from './pages/authSlice'
import { pagesReducer } from './pages'
import { readNavigationRole, saveNavigationRole } from './navigationCache'

export function createAppStore() {
  const navigationRole = readNavigationRole()
  const instance = configureStore({
    reducer: { auth, pages: pagesReducer },
    preloadedState: { auth: { ...auth(undefined, { type: '@@INIT' }), navigationRole } },
  })
  let previousRole = navigationRole
  instance.subscribe(() => {
    const role = instance.getState().auth.navigationRole
    if (role !== previousRole) {
      saveNavigationRole(role)
      previousRole = role
    }
  })
  return instance
}

export const store = createAppStore()
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
