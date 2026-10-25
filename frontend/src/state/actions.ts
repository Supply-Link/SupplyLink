import { store } from './store'
import {
  approveRegistration, createOrder, createUser, adjustStock, loadLicense, loadMe, loadQuote, loadWorkspace,
  readNotifications, receiveBatch, recordPayment, registerAccount, rejectRegistration, reviewReturn,
  saveBusiness, savePricing, saveProduct, setBatchQuarantine, signIn, signOut, trackDelivery, updateOrder, updateUser,
} from './portalSlice'

const dispatch = store.dispatch
const mutate = async <T>(promise: Promise<T>) => { const result = await promise; await dispatch(loadWorkspace()).unwrap(); return result }

/** Promise facade for existing form components; every request runs through a Redux thunk. */
export const api = {
  license: () => dispatch(loadLicense()).unwrap(),
  me: () => dispatch(loadMe()).unwrap(),
  state: () => dispatch(loadWorkspace()).unwrap(),
  login: (body: Parameters<typeof signIn>[0]) => dispatch(signIn(body)).unwrap(),
  logout: () => dispatch(signOut()).unwrap(),
  register: (body: Parameters<typeof registerAccount>[0]) => dispatch(registerAccount(body)).unwrap(),
  quote: (body: Parameters<typeof loadQuote>[0]) => dispatch(loadQuote(body)).unwrap(),
  createOrder: (body: Parameters<typeof createOrder>[0]['body'], key: string) => mutate(dispatch(createOrder({ body, key })).unwrap()),
  updateOrder: (id: string, body: Parameters<typeof updateOrder>[0]['body']) => mutate(dispatch(updateOrder({ id, body })).unwrap()),
  recordPayment: (body: Parameters<typeof recordPayment>[0]['body'], key: string) => mutate(dispatch(recordPayment({ body, key })).unwrap()),
  track: (body: Parameters<typeof trackDelivery>[0]) => mutate(dispatch(trackDelivery(body)).unwrap()),
  reviewReturn: (body: Parameters<typeof reviewReturn>[0]) => mutate(dispatch(reviewReturn(body)).unwrap()),
  updateUser: (body: Parameters<typeof updateUser>[0]) => mutate(dispatch(updateUser(body)).unwrap()),
  createUser: (body: Parameters<typeof createUser>[0]) => mutate(dispatch(createUser(body)).unwrap()),
  approveRegistration: (body: Parameters<typeof approveRegistration>[0]) => mutate(dispatch(approveRegistration(body)).unwrap()),
  rejectRegistration: (body: Parameters<typeof rejectRegistration>[0]) => mutate(dispatch(rejectRegistration(body)).unwrap()),
  saveProduct: (body: Parameters<typeof saveProduct>[0]) => mutate(dispatch(saveProduct(body)).unwrap()),
  receiveBatch: (body: Parameters<typeof receiveBatch>[0]) => mutate(dispatch(receiveBatch(body)).unwrap()),
  adjustStock: (body: Parameters<typeof adjustStock>[0]) => mutate(dispatch(adjustStock(body)).unwrap()),
  setBatchQuarantine: (body: Parameters<typeof setBatchQuarantine>[0]) => mutate(dispatch(setBatchQuarantine(body)).unwrap()),
  savePricing: (body: Parameters<typeof savePricing>[0]) => mutate(dispatch(savePricing(body)).unwrap()),
  saveBusiness: (body: Parameters<typeof saveBusiness>[0]) => mutate(dispatch(saveBusiness(body)).unwrap()),
  readNotifications: () => mutate(dispatch(readNotifications()).unwrap()),
}
