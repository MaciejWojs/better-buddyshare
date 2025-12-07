import { ref, shallowRef, onUnmounted, watch } from 'vue'
import { WebRTCPlayer } from '@eyevinn/webrtc-player'

export function useWhep(channelUrl: string, opts?: { autoStart?: boolean }) {
  const videoElement = shallowRef<HTMLVideoElement | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const error = ref<string | null>(null)
  const player = shallowRef<WebRTCPlayer | null>(null)
  const peerConnection = shallowRef<any | null>(null)

  const start = async () => {
    if (!videoElement.value) return

    isConnecting.value = true
    error.value = null

    try {
      const p = new WebRTCPlayer({
        video: videoElement.value,
        type: 'whep',
        statsTypeFilter: '^candidate-*|^inbound-rtp',
      })

      player.value = p

      await p.load(new URL(channelUrl))
      p.unmute()

      // try to extract underlying RTCPeerConnection from player if available
      try {
        // common property names / getter
        // @ts-ignore
        peerConnection.value = p.pc || p.peerConnection || (typeof p.getPeerConnection === 'function' ? p.getPeerConnection() : null)
      } catch {}

      isConnected.value = true

      // Eventy odtwarzacza
      p.on('no-media', () => {
        console.warn('No media timeout')
      })

      p.on('media-recovered', () => {
        console.log('Media recovered')
      })

      p.on('stats:inbound-rtp', (stats) => {
        // np. bitrate, FPS, jitter:
        console.log(stats)
      })

    } catch (e: any) {
      error.value = e.message ?? String(e)
    }

    isConnecting.value = false
  }

  const stop = async () => {
    try {
      await player.value?.unload()
    } catch (_) {}

    peerConnection.value = null

    isConnected.value = false
  }

  onUnmounted(stop)

  // autoStart: start when video element is available
  if (opts?.autoStart) {
    const stopWatch = watch(
      () => videoElement.value,
      (v) => {
        if (v) {
          // fire and forget
          void start()
          stopWatch()
        }
      },
      { immediate: true }
    )
  }

  return {
    videoElement,
    start,
    stop,
    isConnected,
    isConnecting,
    error,
    peerConnection,
  }
}
