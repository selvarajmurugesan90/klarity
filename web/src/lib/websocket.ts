export type WSMessageHandler = (data: string) => void
export type WSStatusHandler = () => void

export class WSClient {
  private ws: WebSocket | null = null
  private url: string
  private onMessage: WSMessageHandler
  private onClose?: WSStatusHandler
  private onOpen?: WSStatusHandler
  private onError?: (err: Event) => void
  private reconnectDelay = 1000
  private maxDelay = 30000
  private stopped = false
  private _reconnectAttempts = 0

  constructor(
    url: string,
    onMessage: WSMessageHandler,
    opts?: {
      onClose?: WSStatusHandler
      onOpen?: WSStatusHandler
      onError?: (err: Event) => void
    }
  ) {
    this.url = url
    this.onMessage = onMessage
    this.onClose = opts?.onClose
    this.onOpen = opts?.onOpen
    this.onError = opts?.onError
  }

  connect() {
    if (this.stopped) return
    const wsUrl = this.url.startsWith('ws')
      ? this.url
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${this.url}`

    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this._reconnectAttempts = 0
      this.reconnectDelay = 1000
      this.onOpen?.()
    }

    this.ws.onmessage = (e) => this.onMessage(e.data)

    this.ws.onclose = () => {
      this.onClose?.()
      if (!this.stopped) {
        this._reconnectAttempts++
        setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay)
          this.connect()
        }, this.reconnectDelay)
      }
    }

    this.ws.onerror = (e) => {
      this.onError?.(e)
      this.ws?.close()
    }
  }

  send(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    }
  }

  sendResize(cols: number, rows: number) {
    this.send(JSON.stringify({ type: 'resize', cols, rows }))
  }

  close() {
    this.stopped = true
    this.ws?.close()
    this.ws = null
  }

  get readyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  get reconnectAttempts() {
    return this._reconnectAttempts
  }
}

export function buildWSUrl(path: string, params?: Record<string, string>) {
  const url = new URL(
    path,
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`
  )
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return url.toString()
}

export function logsWSUrl(
  ns: string,
  pod: string,
  opts?: { container?: string; previous?: string; timestamps?: string }
) {
  return buildWSUrl(`/ws/logs/${ns}/${pod}`, opts as Record<string, string>)
}

export function execWSUrl(ns: string, pod: string, container: string, shell = 'sh') {
  return buildWSUrl(`/ws/exec/${ns}/${pod}/${container}`, { shell })
}

export function eventsWSUrl(ns?: string) {
  return buildWSUrl('/ws/events', ns ? { namespace: ns } : {})
}

export function metricsWSUrl(interval = '5') {
  return buildWSUrl('/ws/metrics', { interval })
}
