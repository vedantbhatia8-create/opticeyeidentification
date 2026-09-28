/**
 * FutureIrisHardwareSensor — adapter for dedicated near-infrared iris hardware.
 *
 * Production Optic terminals are expected to use an NIR iris camera with an
 * on-device encoder and liveness detection. Such devices usually expose a
 * local bridge (USB/serial driver + daemon). This adapter speaks a small
 * JSON protocol over a local WebSocket so the rest of the app needs no
 * changes when hardware arrives:
 *
 *   → { "type": "hello", "client": "optic-access", "version": 1 }
 *   ← { "type": "device", "name": "...", "serial": "...", "modality": "iris-nir-v1" }
 *   ← { "type": "observation", "observation": SensorObservation }      (streamed)
 *   → { "type": "capture", "id": "<uuid>" }
 *   ← { "type": "sample", "id": "<uuid>", "sample": BiometricSample | null }
 *
 * The device performs segmentation + encoding internally; raw NIR images
 * never reach the browser. Nothing in this repository ships such a device —
 * start() fails with `hardware-disconnected` until one is attached.
 */
import type { BiometricSample } from '../../biometric/types'
import {
  sensorError,
  type BiometricSensor,
  type SensorDescriptor,
  type SensorObservation,
  type SensorStatus,
  type Unsubscribe,
} from '../types'

export const DEFAULT_BRIDGE_URL = 'ws://localhost:7447/optic'

type DeviceMessage =
  | { type: 'device'; name: string; serial: string }
  | { type: 'observation'; observation: SensorObservation }
  | { type: 'sample'; id: string; sample: BiometricSample | null }
  | { type: 'error'; message: string }

export class FutureIrisHardwareSensor implements BiometricSensor {
  descriptor: SensorDescriptor = {
    kind: 'iris-hardware',
    name: 'Optic IR iris module',
    modality: 'iris-nir-v1',
    providesPreview: false,
    supportsPoseGuidance: false,
  }

  private status: SensorStatus = { state: 'idle' }
  private socket: WebSocket | null = null
  private pending = new Map<string, (s: BiometricSample | null) => void>()
  private readonly statusListeners = new Set<(s: SensorStatus) => void>()
  private readonly observationListeners = new Set<(o: SensorObservation) => void>()
  private readonly bridgeUrl: string

  constructor(bridgeUrl = DEFAULT_BRIDGE_URL) {
    this.bridgeUrl = bridgeUrl
  }

  getStatus() {
    return this.status
  }
  getPreviewStream() {
    return null
  }
  onStatus(l: (s: SensorStatus) => void): Unsubscribe {
    this.statusListeners.add(l)
    return () => this.statusListeners.delete(l)
  }
  onObservation(l: (o: SensorObservation) => void): Unsubscribe {
    this.observationListeners.add(l)
    return () => this.observationListeners.delete(l)
  }
  private setStatus(s: SensorStatus) {
    this.status = s
    this.statusListeners.forEach((l) => l(s))
  }

  async start(): Promise<void> {
    this.setStatus({ state: 'starting', detail: 'Connecting to iris module' })
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(this.bridgeUrl)
        const timeout = setTimeout(() => {
          socket.close()
          reject(new Error('timeout'))
        }, 1500)
        socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', client: 'optic-access', version: 1 }))
        socket.onerror = () => {
          clearTimeout(timeout)
          reject(new Error('unreachable'))
        }
        socket.onmessage = (ev) => {
          const msg = JSON.parse(String(ev.data)) as DeviceMessage
          if (msg.type === 'device') {
            clearTimeout(timeout)
            this.descriptor = { ...this.descriptor, name: `${msg.name} · ${msg.serial}` }
            this.socket = socket
            resolve()
          }
          this.handle(msg)
        }
        socket.onclose = () => {
          if (this.status.state === 'running') {
            this.setStatus({ state: 'error', error: sensorError('hardware-disconnected', 'Iris module disconnected.') })
          }
        }
      })
      this.setStatus({ state: 'running' })
    } catch {
      const error = sensorError(
        'hardware-disconnected',
        `No iris module found at ${this.bridgeUrl}. Dedicated hardware is not part of this prototype.`,
      )
      this.setStatus({ state: 'error', error })
      throw error
    }
  }

  private handle(msg: DeviceMessage) {
    if (msg.type === 'observation') this.observationListeners.forEach((l) => l(msg.observation))
    if (msg.type === 'sample') {
      this.pending.get(msg.id)?.(msg.sample)
      this.pending.delete(msg.id)
    }
  }

  async stop() {
    this.socket?.close()
    this.socket = null
    this.pending.forEach((resolve) => resolve(null))
    this.pending.clear()
    if (this.status.state !== 'idle') this.setStatus({ state: 'stopped' })
  }

  captureSample(): Promise<BiometricSample | null> {
    const socket = this.socket
    if (!socket || this.status.state !== 'running') return Promise.resolve(null)
    const id = crypto.randomUUID()
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      socket.send(JSON.stringify({ type: 'capture', id }))
      setTimeout(() => {
        if (this.pending.delete(id)) resolve(null)
      }, 3000)
    })
  }
}
