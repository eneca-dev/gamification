import { getAllProducts, getAllCategories, getCurrentRate } from '@/modules/shop'
import { ProductsClient } from '@/modules/admin/components/ProductsClient'

export default async function AdminProductsPage() {
  const [products, categories, currentRate] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    getCurrentRate(),
  ])

  return <ProductsClient products={products} categories={categories} currentRate={currentRate} />
}
