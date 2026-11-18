// Только локальные проверки: production собирается штатным Next.js.
import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

export async function compileRig() {
  const root = path.resolve(import.meta.dirname, '../..')
  const out = path.join(root, 'tmp/rig/compiled')
  await fs.mkdir(path.join(out, 'components'), { recursive: true })
  for (const file of ['types.ts', 'rig.ts', 'motion.ts', 'motion.client.ts', 'hand-mask-v4.ts', 'validate.ts', 'validate.server.ts', 'import.client.ts', 'components/BimoModelFigure.tsx']) {
    const text = await fs.readFile(path.join(root, 'src/modules/bimo-rig', file), 'utf8')
    let code = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    code = code.replace(/from '((?:\.\/|\.\.\/)[^']+)'/g, (_, name) => `from '${name}.mjs'`)
    code = code.replace("from '@/components/CoinIcon'", "from './CoinIcon.mjs'")
    await fs.writeFile(path.join(out, file.replace(/\.tsx?$/, '.mjs')), code)
  }
  const coin = await fs.readFile(path.join(root, 'src/components/CoinIcon.tsx'), 'utf8')
  await fs.writeFile(path.join(out, 'components/CoinIcon.mjs'), ts.transpileModule(coin, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)
  return { root, out }
}
