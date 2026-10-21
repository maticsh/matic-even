import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

/** The slice of the SDK bridge this package uses. The real bridge and `FakeBridge` both satisfy it. */
export type GlassesBridge = Pick<
  EvenAppBridge,
  | 'createStartUpPageContainer'
  | 'rebuildPageContainer'
  | 'textContainerUpgrade'
  | 'updateImageRawData'
  | 'shutDownPageContainer'
  | 'setLocalStorage'
  | 'getLocalStorage'
  | 'onEvenHubEvent'
  | 'onDeviceStatusChanged'
  | 'audioControl'
  | 'imuControl'
>
