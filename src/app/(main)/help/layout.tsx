import { getHelpFolders } from '@/modules/help'
import { HelpShell } from '@/modules/help/components/HelpShell'

export default async function HelpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const folders = await getHelpFolders()

  return <HelpShell folders={folders}>{children}</HelpShell>
}
