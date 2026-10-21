/**
 * DEV ONLY: the remote and the Kit view. Import this entry from a dev-only page (such as a phone
 * preview on `FakeBridge`), never from the page that ships, so neither reaches the production build.
 */
export { REMOTE_HEIGHT, mountRemote, remoteButtons, remoteHtml, type RemoteButton, type RemoteGesture } from './remote.ts'
export { mountKitView } from './kit-view.ts'
