import { revalidatePath, updateTag } from 'next/cache'
import { balanceTag } from './queries'

/** Cache failures cannot change a committed financial action into a rejected action. */
export function refreshBalanceAfterCommit(userId: string, paths: readonly string[] = []) {
  const effects = [() => updateTag(balanceTag(userId)), ...paths.map(path => () => revalidatePath(path))]
  for (const effect of effects) {
    try { effect() }
    catch (error) { console.error('Post-commit server cache refresh failed:', error) }
  }
}
