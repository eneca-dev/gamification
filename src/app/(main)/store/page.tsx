import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/modules/auth'
import { getProducts, getCategories, getUserBalance } from '@/modules/shop'
import { getPendingResets } from '@/modules/streak-shield'
import { StoreClient } from '@/modules/shop/components/StoreClient'

export default async function StorePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [products, categories, balance, pendingResets] = await Promise.all([
    getProducts(),
    getCategories(),
    user.wsUserId ? getUserBalance(user.wsUserId) : Promise.resolve(0),
    user.wsUserId ? getPendingResets(user.wsUserId) : Promise.resolve([]),
  ])

  return (
    <StoreClient
      products={products}
      categories={categories}
      balance={balance}
      pendingResets={pendingResets}
    />
  )
}
