/** @maticsh/testing: test tools for Even Realities G2 apps. Import them from tests and scripts, never from app code. */
export { FakeBridge, type BridgeCall } from './fake-bridge.ts'
export { lintManifest, type ManifestIssue } from './manifest-lint.ts'
export { scanUrls, whitelistOf, onWhitelist, type UrlFinding, type UrlRule, type ScanFile, type ScanUrlsInput } from './urls.ts'
