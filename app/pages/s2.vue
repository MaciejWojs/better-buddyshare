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
import { ref, computed, watch } from 'vue'
// SRS WHEP endpoint
const whepUrl = 'http://localhost/rtc/v1/whep/?app=live&stream=1'

// Użycie composable useWhep - to znacznie upraszcza kod i usuwa zależność od simple-peer
const { 
  videoElement, 
  start: startStream, 
  stop: stopStream, 
  isConnected, 
  isConnecting, 
  error, 
  peerConnection 
} = useWhep(whepUrl, { autoStart: true })

// Connection status tracking for UI
const connectionStatus = computed(() => {
  if (error.value) return 'Błąd'
  if (isConnected.value) return 'Połączony'
  if (isConnecting.value) return 'Łączenie...'
  return 'Rozłączony'
})

// Stats logic
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
  if (!pc) return
  try {
    const receivers = pc.getReceivers()
    for (const receiver of receivers) {
      if (receiver.track && receiver.track.kind === 'video') {
        const statsReport = await receiver.getStats()
        for (const [id, stat] of statsReport) {
          if (stat.type === 'inbound-rtp' && (stat.mediaType === 'video' || stat.kind === 'video')) {
            stats.value = {
              packetsLost: stat.packetsLost || 0,
              packetsReceived: stat.packetsReceived || 0,
              bytesReceived: stat.bytesReceived || 0,
              jitter: (stat.jitter || 0) * 1000,
              rtt: stats.value.rtt || 0
            }
          }
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
            if (stat.currentRoundTripTime) {
              stats.value.rtt = stat.currentRoundTripTime * 1000
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Błąd podczas zbierania statystyk:', err)
  }
}

// Watch connection state to start/stop stats
watch(isConnected, (connected) => {
  if (connected && peerConnection.value) {
    statsInterval = setInterval(() => collectStats(peerConnection.value), 1000)
  } else {
    if (statsInterval) clearInterval(statsInterval)
    statsInterval = null
  }
})

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