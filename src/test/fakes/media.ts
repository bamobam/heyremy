// Test doubles for the camera APIs jsdom doesn't have: navigator.mediaDevices,
// MediaStream and MediaStreamTrack. Only the parts the camera code uses.

export interface FakeCamera {
  deviceId: string
  label: string
}

type ErrorName = 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | 'OverconstrainedError'

export class FakeTrack extends EventTarget {
  readonly kind = 'video'
  readonly label: string
  readonly deviceId: string
  readyState: 'live' | 'ended' = 'live'
  readonly constraints: MediaTrackConstraints

  constructor(camera: FakeCamera, constraints: MediaTrackConstraints) {
    super()
    this.label = camera.label
    this.deviceId = camera.deviceId
    this.constraints = constraints
  }

  stop() {
    this.readyState = 'ended'
  }

  getSettings(): MediaTrackSettings {
    return { deviceId: this.deviceId, width: 1280, height: 720, frameRate: 30 }
  }

  /** Simulates the browser ending the track, e.g. the camera was unplugged. */
  end() {
    this.readyState = 'ended'
    this.dispatchEvent(new Event('ended'))
  }
}

export class FakeStream {
  private readonly tracks: FakeTrack[]
  constructor(track: FakeTrack) {
    this.tracks = [track]
  }
  getVideoTracks() {
    return this.tracks
  }
  getTracks() {
    return this.tracks
  }
}

export class FakeMediaDevices extends EventTarget {
  cameras: FakeCamera[]
  permissionGranted = false
  /** Every getUserMedia call, in order. */
  readonly calls: MediaStreamConstraints[] = []
  private nextError: ErrorName | null = null

  constructor(cameras: FakeCamera[]) {
    super()
    this.cameras = cameras
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    return this.cameras.map(
      (c) =>
        ({
          deviceId: c.deviceId,
          groupId: '',
          kind: 'videoinput',
          label: this.permissionGranted ? c.label : '',
          toJSON() {},
        }) as MediaDeviceInfo,
    )
  }

  async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    this.calls.push(constraints)
    if (this.nextError) {
      const name = this.nextError
      this.nextError = null
      throw new DOMException(name, name)
    }
    const video = typeof constraints.video === 'object' ? constraints.video : {}
    const wanted = video.deviceId
    const exact = typeof wanted === 'object' && !Array.isArray(wanted) ? wanted.exact : wanted
    const camera = exact ? this.cameras.find((c) => c.deviceId === exact) : this.cameras[0]
    if (!camera) throw new DOMException('NotFoundError', 'NotFoundError')
    this.permissionGranted = true
    return new FakeStream(new FakeTrack(camera, video)) as unknown as MediaStream
  }

  /** The next getUserMedia call rejects with this error. */
  failNext(name: ErrorName) {
    this.nextError = name
  }

  plug(camera: FakeCamera) {
    this.cameras = [...this.cameras, camera]
    this.dispatchEvent(new Event('devicechange'))
  }

  unplug(deviceId: string) {
    this.cameras = this.cameras.filter((c) => c.deviceId !== deviceId)
    this.dispatchEvent(new Event('devicechange'))
  }
}

/** Installs fake devices on navigator.mediaDevices for one test. */
export function installFakeMediaDevices(cameras: FakeCamera[]) {
  const devices = new FakeMediaDevices(cameras)
  Object.defineProperty(navigator, 'mediaDevices', { value: devices, configurable: true })
  return devices
}

export const MACBOOK: FakeCamera = { deviceId: 'mac', label: 'MacBook Air Camera' }
export const IPHONE: FakeCamera = { deviceId: 'iphone', label: 'iPhone Camera' }
export const C270: FakeCamera = { deviceId: 'c270', label: 'UVC Camera (046d:0825)' }
export const C920: FakeCamera = { deviceId: 'c920', label: 'HD Pro Webcam C920 (046d:0892)' }
