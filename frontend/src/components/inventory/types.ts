import type { Batch, Product } from '../../types'

export type Dialog =
  | { kind: 'product'; product?: Product }
  | { kind: 'batches'; product: Product }
  | { kind: 'receive'; product: Product }
  | { kind: 'stock'; product: Product; batch: Batch }
  | { kind: 'quarantine'; product: Product; batch: Batch }
  | null
