import { Box, PackageCheck, ShoppingCart, Truck } from 'lucide-react'

export function AuthStory() {
  return (
    <section className="auth-story">
      <div className="brand"><span><PackageCheck /></span>SupplyLink</div>
      <div className="story-copy">
        <div className="eyebrow">Pharma distribution, connected.</div>
        <h1>Better business.<br /><em>Every step<br />of the way.</em></h1>
        <p>One workspace for your pharmaceutical supply chain. Connect people, products, and deliveries with confidence.</p>
        <div className="flow"><span><Box />Distributors</span><i /><span><ShoppingCart />Retailers</span><i /><span><Truck />Delivery</span></div>
      </div>
      <small>A connected workspace for medicine distribution.</small>
    </section>
  )
}
