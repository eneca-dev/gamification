import { redirect } from 'next/navigation'

import { checkIsAdmin, getCrystalRateHistory } from '@/modules/admin'
import { getAllProducts, getAllCategories, getCurrentRate } from '@/modules/shop'
import { ProductsClient } from '@/modules/admin/components/ProductsClient'

export default async function AdminProductsPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const [products, categories, currentRate, crystalRates] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    getCurrentRate(),
    getCrystalRateHistory(),
  ])

  return (
    <ProductsClient
      products={products}
      categories={categories}
      currentRate={currentRate}
      crystalRates={crystalRates}
    />
  )
}
