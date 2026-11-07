import { ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import {
  BatchTable, Button, Card, Empty, Modal, Notice, PageHeader, ProductCard, ProductFacts, SearchInput,
} from '../components'
import { Cart } from '../components/catalog/Cart'
import { useToast } from '../providers/AppProviders'
import { usePageData } from '../state/pageContext'
import type { Product } from '../types'

export function CatalogScreen() {
  const state = usePageData<'catalog'>()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [showCart, setShowCart] = useState(false)
  const [details, setDetails] = useState<Product | null>(null)
  const toast = useToast()
  const allProducts = state?.products ?? []
  const active = allProducts.filter((product) => product.active)
  const categories = ['all', ...new Set(active.map((product) => product.category))]
  const products = active.filter((product) => (category === 'all' || product.category === category) && `${product.name} ${product.sku} ${product.brand} ${product.category} ${product.strength || ''}`.toLowerCase().includes(query.toLowerCase()))
  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  const handleAddToCart = (product: Product) => {
    const next = (cart[product.id] || 0) + 1
    if (next > product.stock) return toast(`Only ${product.stock} packs are available.`, 'error')
    setCart({ ...cart, [product.id]: next })
    toast(`${product.name} added to order.`)
  }
  return <>
    <PageHeader title="Medicine catalog" subtitle="Generic medicines. Clear stock visibility. Connected distribution." eyebrow={state?.user?.business} actions={<Button onClick={() => setShowCart(true)}><ShoppingCart /> View cart{count ? ` · ${count}` : ''}</Button>} />
    <Notice>India medicine catalog · Seeded prices, pack sizes, and stock are demo trade data.</Notice>
    <div className="toolbar"><div className="actions"><b>{active.length} medicines</b><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value} value={value}>{value === 'all' ? 'All categories' : value}</option>)}</select></div><SearchInput value={query} onChange={setQuery} placeholder="Search medicine, strength or SKU" /></div>
    {products.length ? <div className="catalog-grid">{products.map((product) => <ProductCard key={product.id} product={product} quantity={cart[product.id] || 0} onAdd={() => handleAddToCart(product)} onDetails={() => setDetails(product)} />)}</div> : <Card><Empty title="No matching medicines">Try a different name, strength, or category.</Empty></Card>}
    {showCart && <Cart cart={cart} setCart={setCart} onClose={() => setShowCart(false)} />}
    {details && <Modal title="Batches & medicine details" subtitle={details.name} onClose={() => setDetails(null)} wide><ProductFacts product={details} /><Notice>Stock is reserved by earliest expiry. Expired and quarantined packs are excluded from ordering.</Notice><BatchTable batches={details.batches ?? []} /></Modal>}
  </>
}
