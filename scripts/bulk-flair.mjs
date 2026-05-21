#!/usr/bin/env node
/**
 * Fetch + trace in a loop until the game manifest reaches a target count.
 *
 * Usage:
 *   node scripts/bulk-flair.mjs --target 150
 *   node scripts/bulk-flair.mjs --target 150 --focus character_ip
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.join(ROOT, 'src/game/flair-imported.json')

const parseArgs = () => {
  const args = process.argv.slice(2)
  const options = {
    target: 150,
    focus: null,
    maxRounds: 40,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--target') options.target = Number(args[++i] ?? options.target)
    else if (arg === '--focus') options.focus = args[++i] ?? null
    else if (arg === '--max-rounds') options.maxRounds = Number(args[++i] ?? options.maxRounds)
  }

  return options
}

const runNode = (script, scriptArgs = []) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, script), ...scriptArgs], {
      cwd: ROOT,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${script} exited with code ${code}`))
    })
  })

const readManifestCount = async () => {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8')
    const payload = JSON.parse(raw)
    return payload.assets?.length ?? 0
  } catch {
    return 0
  }
}

const main = async () => {
  const options = parseArgs()
  let round = 0
  let lastCount = await readManifestCount()

  console.log(`Bulk flair target: ${options.target} traced assets (currently ${lastCount})`)

  while (lastCount < options.target && round < options.maxRounds) {
    round += 1
    const remaining = options.target - lastCount
    const downloadTarget = Math.min(remaining + 40, 80)
    const fetchArgs = ['--target', String(downloadTarget + lastCount), '--per-query', '2', '--pages', '4']

    if (options.focus) {
      fetchArgs.push('--category', options.focus)
    } else {
      fetchArgs.push('--mix')
    }

    console.log(`\n— Round ${round}: fetching up to ~${downloadTarget} new images —`)
    await runNode('scripts/fetch-flair.mjs', fetchArgs)
    await runNode('scripts/trace-flair.mjs')

    const nextCount = await readManifestCount()
    console.log(`Traced assets: ${nextCount}/${options.target}`)

    if (nextCount <= lastCount) {
      console.warn('No new traced assets this round — continuing with deeper pagination next round.')
    }

    lastCount = nextCount
  }

  if (lastCount >= options.target) {
    console.log(`\nDone. ${lastCount} imported assets are wired into the game.`)
  } else {
    console.warn(`\nStopped at ${lastCount}/${options.target} after ${round} rounds. Re-run bulk-flair to continue.`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
