/**
 * Checks an Even Hub `app.json` against the packaging and review rules we know about.
 * Run it in every app's tests so a bad manifest fails the tests, not store review.
 */
export type ManifestIssue = { level: 'error' | 'warning'; field: string; message: string }

const PERMISSIONS = ['network', 'location', 'g2-microphone', 'phone-microphone', 'album', 'camera']
const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'zh', 'ja', 'ko']

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function lintManifest(
  manifest: unknown,
  opts: { sdkVersion?: string; usedPermissions?: string[] } = {},
): ManifestIssue[] {
  const issues: ManifestIssue[] = []
  const err = (field: string, message: string) => issues.push({ level: 'error', field, message })
  const warn = (field: string, message: string) => issues.push({ level: 'warning', field, message })
  if (!isObj(manifest)) return [{ level: 'error', field: '', message: 'manifest must be a JSON object' }]
  const m = manifest

  if (typeof m.package_id !== 'string' || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(m.package_id)) {
    err('package_id', 'lowercase reverse-DNS, 2+ segments, letters and digits, each segment starts with a letter')
  }
  if (m.edition !== '202601') err('edition', 'must be "202601"')

  if (typeof m.name !== 'string' || m.name.length < 1 || m.name.length > 20) err('name', 'must be 1-20 characters')
  // Review auto-rejects any name containing "Even", case-insensitive (Even Hub docs: app submission).
  else if (/even/i.test(m.name)) err('name', 'a name containing "Even" (any case) is rejected at review')

  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(m.version)) err('version', 'must be x.y.z with no prefix or suffix')
  if (typeof m.entrypoint !== 'string' || !m.entrypoint) err('entrypoint', 'required')

  if (typeof m.min_sdk_version !== 'string') err('min_sdk_version', 'required')
  else if (opts.sdkVersion && m.min_sdk_version !== opts.sdkVersion) {
    warn('min_sdk_version', `is ${m.min_sdk_version} but the installed SDK is ${opts.sdkVersion}`)
  }
  if ('min_app_version' in m) warn('min_app_version', 'leave it out; the CLI stamps it from the SDK')

  const perms = Array.isArray(m.permissions) ? m.permissions : []
  if (!Array.isArray(m.permissions)) err('permissions', 'must be an array')
  const declared: string[] = []
  perms.forEach((p, i) => {
    const f = `permissions[${i}]`
    if (!isObj(p) || typeof p.name !== 'string' || !PERMISSIONS.includes(p.name)) {
      return err(f, `name must be one of ${PERMISSIONS.join(', ')}`)
    }
    declared.push(p.name)
    if (typeof p.desc !== 'string' || p.desc.length < 1 || p.desc.length > 300) err(`${f}.desc`, 'must be 1-300 characters')
    if (p.name === 'network') {
      const list = Array.isArray(p.whitelist) ? p.whitelist : []
      if (list.length === 0) err(`${f}.whitelist`, 'a network permission needs at least one origin')
      for (const o of list) {
        let ok = false
        try {
          const u = new URL(String(o))
          ok = ['https:', 'wss:'].includes(u.protocol) && !String(o).includes('*') && u.origin === String(o)
        } catch { /* reported below */ }
        if (!ok) err(`${f}.whitelist`, `"${String(o)}" must be a bare https:// or wss:// origin with no path or wildcard`)
      }
    }
  })
  if (opts.usedPermissions) {
    for (const d of declared) if (!opts.usedPermissions.includes(d)) err('permissions', `"${d}" is declared but unused; review flags it`)
    for (const u of opts.usedPermissions) if (!declared.includes(u)) err('permissions', `"${u}" is used but not declared`)
  }

  const langs = m.supported_languages
  if (!Array.isArray(langs) || langs.length === 0) err('supported_languages', 'needs at least one language')
  else for (const l of langs) if (!LANGUAGES.includes(String(l))) err('supported_languages', `"${String(l)}" is not one of ${LANGUAGES.join(' ')}`)

  return issues
}
