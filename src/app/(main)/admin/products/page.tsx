import { redirect } from 'next/navigation'

import { checkIsAdmin } from '@/modules/admin'
import { getAllProducts, getAllCategories, getCurrentRate } from '@/modules/shop'
import { ProductsClient } from '@/modules/admin/components/ProductsClient'

export default async function AdminProductsPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect('/')

  const [products, categories, currentRate] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    getCurrentRate(),
  ])

  return <ProductsClient products={products} categories={categories} currentRate={currentRate} />
}
