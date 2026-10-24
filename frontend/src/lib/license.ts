import type { QueryClient } from '@tanstack/react-query'
import type { LicenseStatus } from '../api/types'

const isBusinessQuery = (query: { queryKey: readonly unknown[] }) =>
  query.queryKey[0] === 'state' || query.queryKey[0] === 'quote'

export function clearBusinessCache(queryClient: QueryClient) {
  void queryClient.cancelQueries({ predicate: isBusinessQuery })
  queryClient.removeQueries({ predicate: isBusinessQuery })
}

export function applyLicenseCachePolicy(queryClient: QueryClient, license: LicenseStatus) {
  if (!license.usable) clearBusinessCache(queryClient)
}
