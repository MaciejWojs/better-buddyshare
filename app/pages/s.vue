<template>
  <v-container class="video-player">
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <v-card elevation="4">
          <v-card-title class="text-h4 text-center">
            <v-icon left color="primary">mdi-video</v-icon>
            WebRTC Video Player
          </v-card-title>
          
          <v-card-text>
            <v-row justify="center">
              <v-col cols="12">
                <div class="video-container">
                  <video 
                    ref="videoElement" 
                    autoplay 
                    playsinline 
                    muted
                    controls
                    class="video-stream"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </v-col>
            </v-row>

            <v-row justify="center" class="mt-4">
              <v-col cols="auto">
                <v-btn
                  @click="startStream"
                  :disabled="isConnecting || isConnected"
                  :loading="isConnecting"
                  color="primary"
                  size="large"
                  prepend-icon="mdi-play"
                >
                  {{ isConnecting ? 'Łączenie...' : 'Start Stream' }}
                </v-btn>
              </v-col>
              <v-col cols="auto">
                <v-btn
                  @click="stopStream"
                  :disabled="!isConnected"
                  color="secondary"
                  size="large"
                  prepend-icon="mdi-stop"
                >
                  Stop Stream
                </v-btn>
              </v-col>
            </v-row>

            <v-row justify="center" class="mt-4">
              <v-col cols="12" md="8">
                <v-alert
                  :type="alertType"
                  :text="connectionStatus"
                  variant="tonal"
                  class="text-center"
                >
                  <template #prepend>
                    <v-icon>{{ statusIcon }}</v-icon>
                  </template>
                </v-alert>
                
                <v-alert
                  v-if="error"
                  type="error"
                  :text="`Błąd: ${error}`"
                  variant="tonal"
                  class="mt-2"
                  closable
                  @click:close="error = ''"
                />
                
                <!-- Statistics panel -->
                <v-card v-if="isConnected" class="mt-4" variant="outlined">
                  <v-card-title class="text-h6">
                    <v-icon left>mdi-chart-line</v-icon>
                    Statystyki połączenia
                  </v-card-title>
                  <v-card-text>
                    <v-row dense>
                      <v-col cols="6" md="3">
                        <v-chip variant="outlined" size="small">
                          <v-icon left size="small">mdi-package-variant-closed</v-icon>
                          Pakiety: {{ stats.packetsReceived }}
                        </v-chip>
                      </v-col>
                      <v-col cols="6" md="3">
                        <v-chip 
                          :color="stats.packetsLost > 10 ? 'error' : 'default'"
                          variant="outlined" 
                          size="small"
                        >
                          <v-icon left size="small">mdi-package-variant-closed-remove</v-icon>
                          Utracone: {{ stats.packetsLost }}
                        </v-chip>
                      </v-col>
                      <v-col cols="6" md="3">
                        <v-chip variant="outlined" size="small">
                          <v-icon left size="small">mdi-download</v-icon>
                          {{ (stats.bytesReceived / 1024 / 1024).toFixed(2) }} MB
                        </v-chip>
                      </v-col>
                      <v-col cols="6" md="3">
                        <v-chip 
                          :color="stats.jitter > 30 ? 'warning' : 'default'"
                          variant="outlined" 
                          size="small"
                        >
                          <v-icon left size="small">mdi-timer-outline</v-icon>
                          Jitter: {{ stats.jitter.toFixed(1) }}ms
                        </v-chip>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useEventListener, useAsyncState, watchOnce } from '@vueuse/core'

// Refs
const videoElement = ref(null)
const whepSessionUrl = ref(null)
const error = ref('')

// SRS WHEP endpoint
const whepUrl = 'http://localhost/rtc/v1/whep/?app=live&stream=1'
// const whepUrl = 'http://localhost:1985/rtc/v1/whep/?app=live&stream=123'

// ICE configuration with multiple STUN servers for better connectivity
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
}

// WebRTC connection management with VueUse
const {
  state: peerConnection,
  isLoading: isConnecting,
  execute: createConnection
} = useAsyncState(async () => {
  const pc = new RTCPeerConnection(iceServers)
  
  // Add transceivers for receiving video/audio
  pc.addTransceiver('video', { direction: 'recvonly' })
  pc.addTransceiver('audio', { direction: 'recvonly' })
  
  return pc
}, null, { immediate: false })

// Connection status tracking
const isConnected = ref(false)
const connectionStatus = ref('Rozłączony')
const stats = ref({
  packetsLost: 0,
  packetsReceived: 0,
  bytesReceived: 0,
  jitter: 0,
  rtt: 0
})
let statsInterval = null

// Computed properties for UI
const alertType = computed(() => {
  if (error.value) return 'error'
  if (isConnected.value) return 'success'
  if (isConnecting.value) return 'info'
  return 'warning'
})

const statusIcon = computed(() => {
  if (error.value) return 'mdi-alert-circle'
  if (isConnected.value) return 'mdi-check-circle'
  if (isConnecting.value) return 'mdi-loading mdi-spin'
  return 'mdi-circle-outline'
})

// Statistics collection function
const collectStats = async (pc) => {
  try {
    const receivers = pc.getReceivers()
    for (const receiver of receivers) {
      if (receiver.track && receiver.track.kind === 'video') {
        const statsReport = await receiver.getStats()
        
        for (const [id, stat] of statsReport) {
          if (stat.type === 'inbound-rtp' && stat.mediaType === 'video') {
            stats.value = {
              packetsLost: stat.packetsLost || 0,
              packetsReceived: stat.packetsReceived || 0,
              bytesReceived: stat.bytesReceived || 0,
              jitter: (stat.jitter || 0) * 1000, // Convert to ms
              rtt: 0 // Will be updated from candidate-pair stats
            }
          }
          
          // Get RTT from candidate pair stats
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
            if (stat.currentRoundTripTime) {
              stats.value.rtt = stat.currentRoundTripTime * 1000 // Convert to ms
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Błąd podczas zbierania statystyk:', err)
  }
}

// Start stats collection
const startStatsCollection = (pc) => {
  if (statsInterval) {
    clearInterval(statsInterval)
  }
  
  statsInterval = setInterval(() => {
    if (isConnected.value && pc) {
      collectStats(pc)
    }
  }, 1000)
}

// Stop stats collection
const stopStatsCollection = () => {
  if (statsInterval) {
    clearInterval(statsInterval)
    statsInterval = null
  }
}

// Stream management functions
const startStream = async () => {
  try {
    error.value = ''
    connectionStatus.value = 'Łączenie...'
    
    // Reset any existing connection
    if (peerConnection.value) {
      peerConnection.value.close()
    }
    
    // Create WebRTC connection
    await createConnection()
    const pc = peerConnection.value
    
    // Setup event listeners using VueUse
    useEventListener(pc, 'track', (event) => {
      console.log('Otrzymano strumień video:', event.streams[0])
      if (videoElement.value && event.streams[0]) {
        videoElement.value.srcObject = event.streams[0]
        
        // Wait for video metadata to load
        videoElement.value.onloadedmetadata = () => {
          console.log('Video metadata załadowane')
          isConnected.value = true
          connectionStatus.value = 'Połączony'
        }
        
        videoElement.value.onerror = (e) => {
          console.error('Błąd odtwarzania video:', e)
          error.value = 'Błąd odtwarzania video'
        }
      }
    })
    
    useEventListener(pc, 'connectionstatechange', () => {
      const state = pc.connectionState
      console.log('Stan połączenia:', state)
      
      switch (state) {
        case 'connected':
          if (!isConnected.value) {
            isConnected.value = true
            connectionStatus.value = 'Połączony'
          }
          break
        case 'disconnected':
          isConnected.value = false
          connectionStatus.value = 'Rozłączony'
          break
        case 'failed':
          isConnected.value = false
          connectionStatus.value = 'Błąd połączenia'
          error.value = 'Połączenie WebRTC nieudane'
          break
        case 'closed':
          isConnected.value = false
          connectionStatus.value = 'Zamknięty'
          break
        default:
          connectionStatus.value = `Stan: ${state}`
      }
    })
    
    useEventListener(pc, 'iceconnectionstatechange', () => {
      const iceState = pc.iceConnectionState
      console.log('ICE Connection State:', iceState)
      
      switch (iceState) {
        case 'checking':
          connectionStatus.value = 'Sprawdzanie połączenia...'
          break
        case 'connected':
          if (!isConnected.value) {
            connectionStatus.value = 'ICE połączony'
          }
          break
        case 'completed':
          if (!isConnected.value) {
            connectionStatus.value = 'ICE ukończony'
          }
          break
        case 'failed':
          error.value = 'ICE połączenie nieudane'
          connectionStatus.value = 'Błąd ICE'
          break
        case 'disconnected':
          if (isConnected.value) {
            connectionStatus.value = 'ICE rozłączony'
          }
          break
        case 'closed':
          connectionStatus.value = 'ICE zamknięty'
          break
        default:
          if (!isConnected.value) {
            connectionStatus.value = `ICE: ${iceState}`
          }
      }
    })
    
    useEventListener(pc, 'icegatheringstatechange', () => {
      console.log('ICE gathering state:', pc.iceGatheringState)
    })
    
    useEventListener(pc, 'icecandidate', (event) => {
      if (event.candidate) {
        console.log('Local ICE candidate:', event.candidate.candidate)
      } else {
        console.log('ICE gathering completed')
      }
    })
    
    // Error handling for peer connection
    useEventListener(pc, 'error', (event) => {
      console.error('WebRTC error:', event)
      error.value = 'Błąd WebRTC'
    })
    
    // Create and send offer with proper timing
    const offer = await pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true
    })
    
    console.log('Utworzono offer:', offer)
    await pc.setLocalDescription(offer)
    
    // Wait for ICE gathering to complete or timeout after 5 seconds
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 5000)
      
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout)
        resolve()
      } else {
        const checkGathering = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            pc.removeEventListener('icegatheringstatechange', checkGathering)
            resolve()
          }
        }
        pc.addEventListener('icegatheringstatechange', checkGathering)
      }
    })
    
    console.log('Wysyłanie offer do SRS...')
    
    // Send offer to SRS via WHEP
    const response = await fetch(whepUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Accept': 'application/sdp'
      },
      body: pc.localDescription.sdp
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`WHEP request failed: ${response.status} ${response.statusText} - ${errorText}`)
    }
    
    // Process SDP answer from SRS
    const answerSdp = await response.text()
    console.log('Otrzymano answer od SRS:', answerSdp.substring(0, 100) + '...')
    
    const answer = new RTCSessionDescription({
      type: 'answer',
      sdp: answerSdp
    })
    
    await pc.setRemoteDescription(answer)
    console.log('SRS WHEP połączenie ustanowione')
    
    // Store session URL for cleanup
    const location = response.headers.get('Location')
    if (location) {
      whepSessionUrl.value = new URL(location, whepUrl).href
      console.log('Session URL:', whepSessionUrl.value)
    }
    
    // Set a timeout to detect if connection doesn't establish
    setTimeout(() => {
      if (!isConnected.value && pc.connectionState !== 'connected') {
        console.warn('Połączenie nie zostało ustanowione w czasie 30 sekund')
        error.value = 'Timeout połączenia - sprawdź czy strumień jest aktywny'
      }
    }, 30000)
    
    // Start collecting stats after a successful connection
    startStatsCollection(pc)
    
    // Start collecting stats after a successful connection
    startStatsCollection(pc)
    
  } catch (err) {
    console.error('Błąd podczas uruchamiania strumienia:', err)
    error.value = err.message || 'Nieznany błąd'
    connectionStatus.value = 'Błąd'
    isConnected.value = false
  }
}

const stopStream = async () => {
  try {
    // Close WHEP session
    if (whepSessionUrl.value) {
      try {
        await fetch(whepSessionUrl.value, { method: 'DELETE' })
        console.log('WHEP session zakończona')
      } catch (err) {
        console.warn('Błąd podczas kończenia sesji WHEP:', err)
      }
      whepSessionUrl.value = null
    }
    
    // Close WebRTC connection
    if (peerConnection.value) {
      peerConnection.value.close()
    }
    
    // Clear video
    if (videoElement.value) {
      videoElement.value.srcObject = null
    }
    
    // Stop collecting stats
    stopStatsCollection()
    
    // Reset state
    isConnected.value = false
    connectionStatus.value = 'Rozłączony'
    error.value = ''
    
  } catch (err) {
    console.error('Błąd podczas zatrzymywania strumienia:', err)
  }
}

// Auto-start stream and cleanup
watchOnce(() => import.meta.client, () => {
  if (import.meta.client) {
    startStream()
  }
})

// Cleanup on page leave
useEventListener(window, 'beforeunload', stopStream)
</script>

<style scoped>
.video-player {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

.video-container {
  margin: 20px 0;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.video-stream {
  width: 100%;
  height: auto;
  max-height: 600px;
  display: block;
  background: #000;
}
</style>