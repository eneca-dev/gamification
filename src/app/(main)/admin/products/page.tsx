import { getAllProducts, getAllCategories } from '@/modules/shop'
import { ProductsClient } from '@/modules/admin/components/ProductsClient'

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
  ])

  return <ProductsClient products={products} categories={categories} />
}
