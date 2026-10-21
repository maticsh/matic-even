import { lintManifest } from '@maticsh/testing'

const issues = lintManifest({
  package_id: 'com.example.Notes',
  edition: '202601',
  name: 'Even Notes',
  version: 'v1.0',
  entrypoint: 'index.html',
  min_sdk_version: '0.0.16',
  permissions: [{
    name: 'network', desc: 'Syncs your notes.',
    whitelist: ['https://api.example.com/v1'],
  }],
  supported_languages: ['en'],
})

for (const i of issues) {
  console.log(`${i.level}  ${i.field}: ${i.message}`)
}
