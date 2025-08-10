<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { io } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'

// Reactive state
const socket = ref(null)
const isConnected = ref(false)
const currentUser = ref(null)
const room = ref(null)
const messages = ref([])
const otherUser = ref(null)
const userStatus = ref({})

// UI state
const showJoinForm = ref(true)
const userName = ref('')
const userLanguage = ref('en-US')
const roomCode = ref('')
const isJoining = ref(false)
const connectionError = ref('')

// Audio and speech state
const isListening = ref(false)
const isSpeaking = ref(false)
const isProcessing = ref(false)
const recognition = ref(null)
const synthesis = ref(null)
const currentMessage = ref('')
const messageInput = ref('')

// WebRTC state
const peerConnection = ref(null)
const localStream = ref(null)
const remoteStream = ref(null)
const isAudioConnected = ref(false)
const isAudioEnabled = ref(true)
const audioQuality = ref('high')
const connectionQuality = ref('excellent')
const latency = ref(0)
const inputVolume = ref(80)
const outputVolume = ref(80)
const microphoneSensitivity = ref(50)
const noiseReduction = ref(true)
const echoCancellation = ref(true)

// Advanced status system
const smartStatus = ref({
  type: 'idle',
  message: '',
  progress: 0,
  details: '',
  timestamp: Date.now()
})

const typingIndicator = ref({
  isTyping: false,
  user: null,
  startTime: null
})

const connectionHealth = ref({
  status: 'excellent', // excellent, good, fair, poor, disconnected
  latency: 0,
  packetLoss: 0,
  bandwidth: 0,
  lastCheck: Date.now()
})

const loadingStates = ref({
  initializing: false,
  connecting: false,
  translating: false,
  speaking: false,
  reconnecting: false
})

// Enhanced chat interface state
const chatInterface = ref({
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  selectedMessage: null,
  messageThreads: new Map(),
  showSearch: false,
  filterBy: 'all', // 'all', 'original', 'translation', 'errors'
  sortBy: 'newest' // 'newest', 'oldest', 'relevance'
})

// Connection optimization state
const connectionOptimization = ref({
  isReconnecting: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  adaptiveQuality: true,
  bandwidthMonitoring: true,
  lastBandwidthCheck: 0,
  networkType: 'unknown',
  connectionStability: 'stable' // 'stable', 'unstable', 'poor'
})

// Error handling and recovery system
const errorHandling = ref({
  errors: [],
  showErrorPanel: false,
  lastError: null,
  errorCount: 0,
  recoveryAttempts: 0,
  gracefulDegradation: {
    audioFallback: false,
    translationFallback: false,
    offlineMode: false
  }
})

// Error types and severity levels
const ErrorTypes = {
  NETWORK: 'network',
  AUDIO: 'audio',
  TRANSLATION: 'translation',
  PERMISSION: 'permission',
  BROWSER: 'browser',
  SERVER: 'server',
  UNKNOWN: 'unknown'
}

const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
}

// Available languages
const languages = [
  { code: 'en-US', name: '🇺🇸 English', flag: '🇺🇸' },
  { code: 'es-ES', name: '🇪🇸 Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: '🇫🇷 French', flag: '🇫🇷' },
  { code: 'de-DE', name: '🇩🇪 German', flag: '🇩🇪' },
  { code: 'it-IT', name: '🇮🇹 Italian', flag: '🇮🇹' },
  { code: 'pt-PT', name: '🇵🇹 Portuguese', flag: '🇵🇹' },
  { code: 'ru-RU', name: '🇷🇺 Russian', flag: '🇷🇺' },
  { code: 'ja-JP', name: '🇯🇵 Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: '🇰🇷 Korean', flag: '🇰🇷' },
  { code: 'zh-CN', name: '🇨🇳 Chinese', flag: '🇨🇳' },
  { code: 'ar-SA', name: '🇸🇦 Arabic', flag: '🇸🇦' },
  { code: 'hi-IN', name: '🇮🇳 Hindi', flag: '🇮🇳' },
  { code: 'bn-BD', name: '🇧🇩 Bengali', flag: '🇧🇩' }
]

// Initialize socket connection
const initSocket = () => {
  socket.value = io('http://localhost:3001', {
    transports: ['websocket'],
    upgrade: false
  })

  socket.value.on('connect', () => {
    isConnected.value = true
    connectionError.value = ''
    console.log('🔗 Connected to server')
  })

  socket.value.on('disconnect', (reason) => {
    console.log('❌ Disconnected from server:', reason)
    isConnected.value = false

    // Handle different disconnect reasons
    if (reason === 'io server disconnect') {
      // Server initiated disconnect - don't reconnect automatically
      updateSmartStatus('error', 'Server disconnected. Please refresh the page.', 0)
    } else {
      // Client-side disconnect - attempt reconnection
      handleConnectionStateChange('disconnected')
    }
  })

  socket.value.on('connect_error', (error) => {
    console.error('🚨 Connection error:', error)
    isConnected.value = false
    connectionError.value = 'Failed to connect to server. Please try again.'
    handleConnectionStateChange('failed')
  })

  socket.value.on('reconnect', (attemptNumber) => {
    console.log('✅ Reconnected after', attemptNumber, 'attempts')
    isConnected.value = true
    connectionError.value = ''
    updateSmartStatus('success', 'Reconnected successfully!', 100)
  })

  socket.value.on('reconnect_attempt', (attemptNumber) => {
    console.log('🔄 Reconnection attempt', attemptNumber)
    updateSmartStatus('warning', `Reconnecting... (attempt ${attemptNumber})`,
                     Math.min((attemptNumber / 5) * 100, 90))
  })

  socket.value.on('reconnect_error', (error) => {
    console.error('❌ Reconnection failed:', error)
  })

  socket.value.on('reconnect_failed', () => {
    console.error('🚨 Reconnection failed permanently')
    updateSmartStatus('error', 'Connection failed. Please refresh the page.', 0)
  })

  socket.value.on('user-joined', (data) => {
    console.log('👥 User joined:', data)
    room.value = data.room
    updateOtherUser()

    // Initiate WebRTC call when another user joins
    setTimeout(() => {
      if (otherUser.value && peerConnection.value) {
        initWebRTCCall()
      }
    }, 1000)
  })

  socket.value.on('user-left', (data) => {
    console.log('👋 User left:', data)
    room.value = data.room
    updateOtherUser()
  })

  socket.value.on('new-message', (message) => {
    console.log('💬 New message:', message)
    messages.value.push(message)
    scrollToBottom()

    // If it's a translation for us, speak it with enhanced features
    if (message.type === 'translation' && message.targetUserId === currentUser.value?.userId) {
      const speechOptions = {
        gender: voicePreferences.gender,
        accent: voicePreferences.accent,
        contextHints: message.contextHints
      }
      speakText(message.translatedText, message.targetLanguage, speechOptions)
    }
  })

  socket.value.on('user-status', (status) => {
    console.log('📊 User status:', status)
    userStatus.value[status.userId] = status
  })

  // WebRTC signaling handlers
  socket.value.on('webrtc-offer', async (data) => {
    console.log('📞 Received WebRTC offer:', data)
    await handleWebRTCOffer(data)
  })

  socket.value.on('webrtc-answer', async (data) => {
    console.log('📞 Received WebRTC answer:', data)
    await handleWebRTCAnswer(data)
  })

  socket.value.on('webrtc-ice-candidate', async (data) => {
    console.log('🧊 Received ICE candidate:', data)
    await handleICECandidate(data)
  })

  // Typing indicator handlers
  socket.value.on('typing-start', (data) => {
    if (data.userId !== currentUser.value?.userId) {
      typingIndicator.value = {
        isTyping: true,
        user: data.userName,
        startTime: Date.now()
      }
    }
  })

  socket.value.on('typing-stop', (data) => {
    if (data.userId !== currentUser.value?.userId) {
      typingIndicator.value.isTyping = false
    }
  })
}

// Update other user reference
const updateOtherUser = () => {
  if (room.value && currentUser.value) {
    const users = room.value.users || []
    otherUser.value = users.find(user => user.socketId !== currentUser.value.socketId)
  }
}

// Create a new room
const createRoom = async () => {
  if (!userName.value.trim()) {
    connectionError.value = 'Please enter your name'
    return
  }

  isJoining.value = true
  connectionError.value = ''

  const userInfo = {
    name: userName.value.trim(),
    language: userLanguage.value,
    avatar: getRandomAvatar()
  }

  socket.value.emit('create-room', userInfo, (response) => {
    isJoining.value = false

    if (response.success) {
      currentUser.value = { userId: response.userId, ...userInfo }
      room.value = response.room
      roomCode.value = response.roomCode
      showJoinForm.value = false
      updateOtherUser()
      initSpeechRecognition()
      initWebRTC()
      console.log('🏠 Room created:', response.roomCode)
    } else {
      connectionError.value = response.error || 'Failed to create room'
    }
  })
}

// Join an existing room
const joinRoom = async () => {
  if (!userName.value.trim() || !roomCode.value.trim()) {
    connectionError.value = 'Please enter your name and room code'
    return
  }

  isJoining.value = true
  connectionError.value = ''

  const userInfo = {
    name: userName.value.trim(),
    language: userLanguage.value,
    avatar: getRandomAvatar()
  }

  socket.value.emit('join-room', {
    roomCode: roomCode.value.toUpperCase(),
    userInfo
  }, (response) => {
    isJoining.value = false

    if (response.success) {
      currentUser.value = { userId: response.userId, ...userInfo }
      room.value = response.room
      showJoinForm.value = false
      updateOtherUser()
      initSpeechRecognition()
      initWebRTC()
      console.log('👥 Joined room:', roomCode.value)
    } else {
      connectionError.value = response.error || 'Failed to join room'
    }
  })
}

// Get random avatar emoji
const getRandomAvatar = () => {
  const avatars = ['👤', '👨', '👩', '🧑', '👨‍💼', '👩‍💼', '👨‍🎓', '👩‍🎓', '👨‍💻', '👩‍💻']
  return avatars[Math.floor(Math.random() * avatars.length)]
}

// Initialize speech recognition with enhanced features
const initSpeechRecognition = () => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition.value = new SpeechRecognition()

    // Enhanced configuration
    recognition.value.continuous = false
    recognition.value.interimResults = true // Enable interim results for better UX
    recognition.value.maxAlternatives = 3 // Get multiple alternatives
    recognition.value.lang = userLanguage.value

    recognition.value.onstart = () => {
      isListening.value = true
      sendStatusUpdate({ type: 'listening', message: 'Listening...' })
      console.log('🎤 Speech recognition started')
    }

    recognition.value.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript

        if (result.isFinal) {
          finalTranscript += transcript
          const confidence = result[0].confidence || 0

          // Get alternative transcripts for better accuracy
          const alternatives = []
          for (let j = 0; j < Math.min(result.length, 3); j++) {
            alternatives.push({
              transcript: result[j].transcript,
              confidence: result[j].confidence || 0
            })
          }

          console.log('🎤 Final speech recognized:', finalTranscript, 'Confidence:', confidence)
          console.log('🎤 Alternatives:', alternatives)

          // Process the best result
          processVoiceMessage(finalTranscript.trim(), confidence, alternatives)
        } else {
          interimTranscript += transcript
          // Show interim results to user
          currentMessage.value = interimTranscript
        }
      }
    }

    recognition.value.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      handleSpeechRecognitionError(event.error)
    }

    recognition.value.onend = () => {
      isListening.value = false
      currentMessage.value = ''
      sendStatusUpdate({ type: 'idle' })
      console.log('🎤 Speech recognition ended')
    }

    recognition.value.onspeechstart = () => {
      console.log('🗣️ Speech detected')
      sendStatusUpdate({ type: 'speech-detected', message: 'Speech detected...' })
    }

    recognition.value.onspeechend = () => {
      console.log('🔇 Speech ended')
      sendStatusUpdate({ type: 'processing', message: 'Processing speech...' })
    }

    recognition.value.onnomatch = () => {
      console.warn('⚠️ No speech match found')
      sendStatusUpdate({ type: 'no-match', message: 'No speech recognized, try again' })
    }
  } else {
    console.error('❌ Speech recognition not supported')
    connectionError.value = 'Speech recognition not supported in this browser'
  }

  // Initialize speech synthesis with enhanced features
  initSpeechSynthesis()
}

// Enhanced speech synthesis initialization
const initSpeechSynthesis = () => {
  synthesis.value = window.speechSynthesis

  // Load voices when available
  const loadVoices = () => {
    const voices = synthesis.value.getVoices()
    console.log(`🔊 Loaded ${voices.length} voices`)

    // Log available voices for debugging
    voices.forEach(voice => {
      console.log(`Voice: ${voice.name} (${voice.lang}) - ${voice.localService ? 'Local' : 'Remote'}`)
    })
  }

  // Load voices immediately if available
  loadVoices()

  // Also load when voices change (some browsers load asynchronously)
  synthesis.value.addEventListener('voiceschanged', loadVoices)
}

// Handle speech recognition errors with specific actions
const handleSpeechRecognitionError = (error) => {
  isListening.value = false
  currentMessage.value = ''

  let errorMessage = 'Speech recognition error'
  let shouldRetry = false

  switch (error) {
    case 'network':
      errorMessage = 'Network error. Check your connection.'
      shouldRetry = true
      break
    case 'not-allowed':
      errorMessage = 'Microphone access denied. Please allow microphone access.'
      break
    case 'no-speech':
      errorMessage = 'No speech detected. Try speaking louder.'
      shouldRetry = true
      break
    case 'aborted':
      errorMessage = 'Speech recognition aborted'
      break
    case 'audio-capture':
      errorMessage = 'Audio capture failed. Check your microphone.'
      break
    case 'service-not-allowed':
      errorMessage = 'Speech recognition service not allowed'
      break
    default:
      errorMessage = `Speech recognition error: ${error}`
      shouldRetry = true
  }

  console.error('🚨 Speech recognition error:', error, errorMessage)
  sendStatusUpdate({ type: 'error', message: errorMessage })

  // Auto-retry for certain errors
  if (shouldRetry && otherUser.value) {
    setTimeout(() => {
      console.log('🔄 Auto-retrying speech recognition...')
      toggleVoiceRecording()
    }, 2000)
  }
}

// Initialize WebRTC connection
const initWebRTC = async () => {
  try {
    console.log('🔗 Initializing WebRTC...')

    // Get user media with enhanced audio constraints
    const constraints = {
      audio: {
        // Core audio processing
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,

        // Quality settings
        sampleRate: audioQuality.value === 'high' ? 48000 : 16000,
        sampleSize: 16,
        channelCount: 1,

        // Advanced audio processing
        googEchoCancellation: true,
        googAutoGainControl: true,
        googNoiseSuppression: true,
        googHighpassFilter: true,
        googTypingNoiseDetection: true,
        googAudioMirroring: false,

        // Latency optimization
        latency: 0.01, // 10ms target latency

        // Volume and gain
        volume: 1.0,

        // Advanced constraints for better quality
        ...(audioQuality.value === 'high' && {
          googAudioProcessing: true,
          googBeamforming: true,
          googArrayGeometry: true,
          googAudioProcessing64kHz: true
        })
      },
      video: false
    }

    localStream.value = await navigator.mediaDevices.getUserMedia(constraints)
    console.log('🎤 Local audio stream obtained')

    // Setup audio processing pipeline
    const audioProcessing = setupAudioProcessing(localStream.value)
    const processedStream = audioProcessing.processedStream || localStream.value

    // Setup audio level monitoring
    const audioMonitoring = monitorAudioLevels(localStream.value)

    // Create peer connection
    await createPeerConnection()

    // Add processed stream to peer connection
    processedStream.getTracks().forEach(track => {
      peerConnection.value.addTrack(track, processedStream)
    })

    // Store cleanup functions
    window.audioProcessingCleanup = () => {
      audioProcessing.cleanup()
      audioMonitoring.cleanup()
    }

    console.log('✅ WebRTC initialized successfully')
  } catch (error) {
    console.error('❌ WebRTC initialization failed:', error)
    connectionError.value = 'Failed to access microphone. Please allow microphone access.'
  }
}

// Create peer connection with ICE servers
const createPeerConnection = async () => {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  }

  peerConnection.value = new RTCPeerConnection(configuration)

  // Handle ICE candidates
  peerConnection.value.onicecandidate = (event) => {
    if (event.candidate && socket.value) {
      console.log('🧊 Sending ICE candidate')
      socket.value.emit('webrtc-ice-candidate', {
        candidate: event.candidate
      })
    }
  }

  // Handle remote stream
  peerConnection.value.ontrack = (event) => {
    console.log('🔊 Received remote audio stream')
    remoteStream.value = event.streams[0]
    isAudioConnected.value = true

    // Create audio element for remote stream
    const audioElement = document.getElementById('remote-audio')
    if (audioElement) {
      audioElement.srcObject = remoteStream.value

      // Setup audio buffering
      setupAudioBuffering(audioElement)

      // Play with error handling
      audioElement.play().catch(e => {
        console.log('Audio autoplay prevented:', e)
        // Show user interaction required message
        connectionError.value = 'Click anywhere to enable audio playback'

        // Auto-enable on user interaction
        const enableAudio = () => {
          audioElement.play()
          connectionError.value = ''
          document.removeEventListener('click', enableAudio)
        }
        document.addEventListener('click', enableAudio)
      })
    }
  }

  // Monitor connection state
  peerConnection.value.onconnectionstatechange = () => {
    const state = peerConnection.value.connectionState
    console.log('🔗 Connection state:', state)

    switch (state) {
      case 'connected':
        isAudioConnected.value = true
        connectionQuality.value = 'excellent'
        break
      case 'disconnected':
      case 'failed':
        isAudioConnected.value = false
        connectionQuality.value = 'poor'
        // Attempt to reconnect
        setTimeout(() => {
          if (otherUser.value) {
            initWebRTCCall()
          }
        }, 2000)
        break
    }
  }

  // Monitor ICE connection state
  peerConnection.value.oniceconnectionstatechange = () => {
    const state = peerConnection.value.iceConnectionState
    console.log('🧊 ICE connection state:', state)

    if (state === 'connected' || state === 'completed') {
      measureLatency()

      // Start periodic quality monitoring
      const qualityMonitor = setInterval(() => {
        adaptAudioQuality()
        measureLatency()
      }, 5000) // Check every 5 seconds

      // Store interval for cleanup
      window.qualityMonitorInterval = qualityMonitor
    }
  }
}

// Initiate WebRTC call (caller)
const initWebRTCCall = async () => {
  if (!peerConnection.value || !otherUser.value) return

  try {
    console.log('📞 Initiating WebRTC call...')

    const offer = await peerConnection.value.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    })

    await peerConnection.value.setLocalDescription(offer)

    socket.value.emit('webrtc-offer', {
      offer: offer,
      targetUserId: otherUser.value.userId
    })

    console.log('📤 WebRTC offer sent')
  } catch (error) {
    console.error('❌ Failed to create WebRTC offer:', error)
  }
}

// Handle incoming WebRTC offer (callee)
const handleWebRTCOffer = async (data) => {
  if (!peerConnection.value) return

  try {
    console.log('📞 Handling WebRTC offer...')

    await peerConnection.value.setRemoteDescription(data.offer)

    const answer = await peerConnection.value.createAnswer()
    await peerConnection.value.setLocalDescription(answer)

    socket.value.emit('webrtc-answer', {
      answer: answer,
      targetUserId: data.fromUserId
    })

    console.log('📤 WebRTC answer sent')
  } catch (error) {
    console.error('❌ Failed to handle WebRTC offer:', error)
  }
}

// Handle incoming WebRTC answer (caller)
const handleWebRTCAnswer = async (data) => {
  if (!peerConnection.value) return

  try {
    console.log('📞 Handling WebRTC answer...')
    await peerConnection.value.setRemoteDescription(data.answer)
    console.log('✅ WebRTC connection established')
  } catch (error) {
    console.error('❌ Failed to handle WebRTC answer:', error)
  }
}

// Handle ICE candidates
const handleICECandidate = async (data) => {
  if (!peerConnection.value) return

  try {
    await peerConnection.value.addIceCandidate(data.candidate)
    console.log('🧊 ICE candidate added')
  } catch (error) {
    console.error('❌ Failed to add ICE candidate:', error)
  }
}

// Measure connection latency
const measureLatency = () => {
  const startTime = Date.now()

  // Simple ping-pong latency measurement
  if (socket.value) {
    socket.value.emit('ping', startTime)
    socket.value.once('pong', (timestamp) => {
      latency.value = Date.now() - timestamp

      // Update connection quality based on latency
      if (latency.value < 100) {
        connectionQuality.value = 'excellent'
      } else if (latency.value < 300) {
        connectionQuality.value = 'good'
      } else if (latency.value < 500) {
        connectionQuality.value = 'fair'
      } else {
        connectionQuality.value = 'poor'
      }
    })
  }
}

// Toggle audio on/off
const toggleAudio = () => {
  if (localStream.value) {
    const audioTrack = localStream.value.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      isAudioEnabled.value = audioTrack.enabled
      console.log(`🔊 Audio ${isAudioEnabled.value ? 'enabled' : 'disabled'}`)
    }
  }
}

// Adjust audio quality
const setAudioQuality = (quality) => {
  audioQuality.value = quality

  // Restart audio stream with new quality settings
  if (localStream.value) {
    restartAudioStream()
  }
}

// Restart audio stream with new settings
const restartAudioStream = async () => {
  try {
    // Stop current stream
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => track.stop())
    }

    // Get new stream with updated constraints
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: audioQuality.value === 'high' ? 48000 : 16000,
        channelCount: 1
      },
      video: false
    }

    localStream.value = await navigator.mediaDevices.getUserMedia(constraints)

    // Replace tracks in peer connection
    if (peerConnection.value) {
      const sender = peerConnection.value.getSenders().find(s =>
        s.track && s.track.kind === 'audio'
      )

      if (sender) {
        await sender.replaceTrack(localStream.value.getAudioTracks()[0])
      }
    }

    console.log(`🔊 Audio quality updated to ${audioQuality.value}`)
  } catch (error) {
    console.error('❌ Failed to restart audio stream:', error)
  }
}

// Audio processing pipeline with Web Audio API
const setupAudioProcessing = (stream) => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const source = audioContext.createMediaStreamSource(stream)
    const destination = audioContext.createMediaStreamDestination()

    // Create audio processing nodes
    const gainNode = audioContext.createGain()
    const compressor = audioContext.createDynamicsCompressor()
    const filter = audioContext.createBiquadFilter()

    // Configure compressor for voice optimization
    compressor.threshold.setValueAtTime(-24, audioContext.currentTime)
    compressor.knee.setValueAtTime(30, audioContext.currentTime)
    compressor.ratio.setValueAtTime(12, audioContext.currentTime)
    compressor.attack.setValueAtTime(0.003, audioContext.currentTime)
    compressor.release.setValueAtTime(0.25, audioContext.currentTime)

    // Configure high-pass filter to remove low-frequency noise
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(80, audioContext.currentTime) // Remove frequencies below 80Hz
    filter.Q.setValueAtTime(1, audioContext.currentTime)

    // Set initial gain based on input volume
    const initialGain = inputVolume.value / 100
    gainNode.gain.setValueAtTime(initialGain, audioContext.currentTime)

    // Store gain node globally for volume control
    window.audioGainNode = gainNode

    // Connect the audio processing chain
    source.connect(filter)
    filter.connect(compressor)
    compressor.connect(gainNode)
    gainNode.connect(destination)

    console.log('🎛️ Audio processing pipeline initialized')

    return {
      audioContext,
      processedStream: destination.stream,
      gainNode,
      compressor,
      filter,
      cleanup: () => {
        window.audioGainNode = null
        audioContext.close()
      }
    }
  } catch (error) {
    console.error('❌ Failed to setup audio processing:', error)
    return { processedStream: stream, cleanup: () => {} }
  }
}

// Real-time audio level monitoring
const monitorAudioLevels = (stream) => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const analyser = audioContext.createAnalyser()
    const source = audioContext.createMediaStreamSource(stream)

    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8

    source.connect(analyser)

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray)

      // Calculate average volume
      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i]
      }
      const average = sum / bufferLength

      // Update UI with audio level (you can use this for visual feedback)
      const audioLevel = Math.round((average / 255) * 100)

      // Detect silence (for auto-stop functionality)
      if (isListening.value && audioLevel < 5) {
        // Could implement auto-stop after silence
      }

      requestAnimationFrame(checkAudioLevel)
    }

    checkAudioLevel()

    return {
      audioContext,
      analyser,
      cleanup: () => {
        audioContext.close()
      }
    }
  } catch (error) {
    console.error('❌ Failed to setup audio monitoring:', error)
    return { cleanup: () => {} }
  }
}

// Adaptive audio quality based on connection
const adaptAudioQuality = () => {
  if (!peerConnection.value) return

  const stats = peerConnection.value.getStats()
  stats.then(reports => {
    reports.forEach(report => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
        const packetsLost = report.packetsLost || 0
        const packetsReceived = report.packetsReceived || 0
        const lossRate = packetsLost / (packetsLost + packetsReceived)

        // Adapt quality based on packet loss
        if (lossRate > 0.05 && audioQuality.value === 'high') {
          console.log('📉 High packet loss detected, reducing audio quality')
          setAudioQuality('standard')
        } else if (lossRate < 0.01 && audioQuality.value === 'standard') {
          console.log('📈 Good connection detected, increasing audio quality')
          setAudioQuality('high')
        }
      }
    })
  }).catch(error => {
    console.error('Failed to get connection stats:', error)
  })
}

// Audio buffering for smooth playback
const setupAudioBuffering = (audioElement) => {
  if (!audioElement) return

  // Configure audio element for optimal playback
  audioElement.preload = 'auto'
  audioElement.autoplay = true
  audioElement.playsInline = true

  // Handle buffering events
  audioElement.addEventListener('waiting', () => {
    console.log('🔄 Audio buffering...')
  })

  audioElement.addEventListener('canplay', () => {
    console.log('▶️ Audio ready to play')
  })

  audioElement.addEventListener('stalled', () => {
    console.log('⚠️ Audio playback stalled')
  })

  // Implement adaptive buffering
  audioElement.addEventListener('timeupdate', () => {
    const buffered = audioElement.buffered
    if (buffered.length > 0) {
      const bufferedEnd = buffered.end(buffered.length - 1)
      const currentTime = audioElement.currentTime
      const bufferHealth = bufferedEnd - currentTime

      // Maintain healthy buffer
      if (bufferHealth < 0.1) {
        console.log('⚠️ Low audio buffer')
      }
    }
  })
}

// Enhanced voice message processing with language detection and validation
const processVoiceMessage = async (text, confidence, alternatives = []) => {
  if (!otherUser.value) {
    console.warn('No other user to send message to')
    return
  }

  // Validate input
  if (!text || text.trim().length < 2) {
    console.warn('Text too short, ignoring')
    sendStatusUpdate({ type: 'error', message: 'Speech too short, try again' })
    return
  }

  // Check confidence threshold
  if (confidence < 0.3) {
    console.warn('Low confidence speech recognition:', confidence)
    sendStatusUpdate({ type: 'low-confidence', message: 'Low confidence, try speaking clearer' })

    // Still process but with warning
  }

  isProcessing.value = true
  sendStatusUpdate({ type: 'processing', message: 'Processing speech...' })

  // Detect language if different from user's selected language
  const detectedLanguage = await detectLanguage(text)
  const sourceLanguage = detectedLanguage || userLanguage.value

  // Send original message with enhanced metadata
  const originalMessage = {
    type: 'original',
    text: text,
    confidence: confidence,
    language: sourceLanguage,
    detectedLanguage: detectedLanguage,
    alternatives: alternatives,
    targetUserId: null,
    timestamp: Date.now()
  }

  socket.value.emit('send-message', originalMessage)

  try {
    // Translate the message with retry logic
    sendStatusUpdate({ type: 'translating', message: 'Translating...' })

    let translation
    let translationAttempts = 0
    const maxAttempts = 3

    while (translationAttempts < maxAttempts) {
      try {
        translation = await translateText(text, sourceLanguage, otherUser.value.language)
        break
      } catch (error) {
        translationAttempts++
        console.warn(`Translation attempt ${translationAttempts} failed:`, error)

        if (translationAttempts < maxAttempts) {
          // Try with alternatives if available
          if (alternatives.length > translationAttempts - 1) {
            const alternative = alternatives[translationAttempts - 1]
            console.log(`Trying alternative: ${alternative.transcript}`)
            text = alternative.transcript
          }

          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait before retry
        }
      }
    }

    if (!translation) {
      throw new Error('All translation attempts failed')
    }

    // Enhance translation with context and cultural adaptation
    const enhancedTranslation = await enhanceTranslationWithContext(
      text,
      translation,
      sourceLanguage,
      otherUser.value.language
    )

    // Send translation with enhanced metadata
    const translationMessage = {
      type: 'translation',
      originalText: text,
      translatedText: enhancedTranslation.translation,
      sourceLanguage: sourceLanguage,
      targetLanguage: otherUser.value.language,
      targetUserId: otherUser.value.userId || otherUser.value.socketId,
      confidence: confidence,
      contextualConfidence: enhancedTranslation.confidence,
      detectedLanguage: detectedLanguage,
      translationAttempts: translationAttempts,
      contextHints: enhancedTranslation.contextHints,
      timestamp: Date.now()
    }

    socket.value.emit('send-message', translationMessage)

    // Log successful processing
    console.log('✅ Voice message processed successfully:', {
      original: text,
      translation: translation,
      confidence: confidence,
      attempts: translationAttempts
    })

  } catch (error) {
    console.error('❌ Voice message processing failed:', error)
    sendStatusUpdate({ type: 'error', message: 'Translation failed, try again' })

    // Send error message to other user
    const errorMessage = {
      type: 'error',
      originalText: text,
      error: 'Translation failed',
      sourceLanguage: sourceLanguage,
      targetLanguage: otherUser.value.language,
      targetUserId: otherUser.value.userId || otherUser.value.socketId,
      timestamp: Date.now()
    }

    socket.value.emit('send-message', errorMessage)
  } finally {
    isProcessing.value = false
    sendStatusUpdate({ type: 'idle' })
  }
}

// Simple language detection (can be enhanced with external APIs)
const detectLanguage = async (text) => {
  // Basic language detection patterns
  const patterns = {
    'es': /\b(el|la|los|las|un|una|de|en|y|que|es|por|para|con|se|no|te|le|da|su|por|son|como|pero|muy|todo|bien|más|sí|ya|aquí|ahora|cuando|donde|porque|cómo|qué|quién|cuál|cuánto|cuándo|dónde|hola|gracias|por favor|buenos días|buenas tardes|buenas noches)\b/gi,
    'fr': /\b(le|la|les|un|une|de|du|des|et|que|est|pour|avec|se|ne|pas|te|lui|son|sa|ses|sont|comme|mais|très|tout|bien|plus|oui|déjà|ici|maintenant|quand|où|parce que|comment|quoi|qui|quel|combien|bonjour|merci|s'il vous plaît|bonne journée|bonsoir|bonne nuit)\b/gi,
    'de': /\b(der|die|das|ein|eine|und|ist|zu|mit|sich|nicht|ich|du|er|sie|es|wir|ihr|sie|sind|wie|aber|sehr|alle|gut|mehr|ja|schon|hier|jetzt|wenn|wo|weil|wie|was|wer|welche|wie viel|wann|hallo|danke|bitte|guten tag|guten abend|gute nacht)\b/gi,
    'it': /\b(il|la|lo|gli|le|un|una|di|da|in|con|su|per|tra|fra|a|e|che|è|sono|come|ma|molto|tutto|bene|più|sì|già|qui|ora|quando|dove|perché|come|cosa|chi|quale|quanto|ciao|grazie|prego|buongiorno|buonasera|buonanotte)\b/gi,
    'pt': /\b(o|a|os|as|um|uma|de|da|do|das|dos|em|na|no|nas|nos|com|por|para|entre|e|que|é|são|como|mas|muito|tudo|bem|mais|sim|já|aqui|agora|quando|onde|porque|como|o que|quem|qual|quanto|olá|obrigado|obrigada|por favor|bom dia|boa tarde|boa noite)\b/gi,
    'ru': /\b(и|в|не|на|я|быть|тот|он|оно|она|они|а|то|все|она|так|его|но|да|ты|к|у|же|вы|за|бы|по|только|ее|мне|было|вот|от|меня|еще|нет|о|из|ему|теперь|когда|даже|ну|вдруг|ли|если|уже|или|ни|быть|иметь|мочь|сказать|говорить|знать|стать|видеть|хотеть|идти|стоять|думать|спросить|жить|смотреть|сидеть|понимать|делать|значить|быть|мочь)\b/gi,
    'ja': /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
    'ko': /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g,
    'zh': /[\u4E00-\u9FFF]/g,
    'ar': /[\u0600-\u06FF]/g,
    'hi': /[\u0900-\u097F]/g
  }

  let maxMatches = 0
  let detectedLang = null

  for (const [lang, pattern] of Object.entries(patterns)) {
    const matches = (text.match(pattern) || []).length
    if (matches > maxMatches && matches > 2) { // Require at least 3 matches
      maxMatches = matches
      detectedLang = lang
    }
  }

  // Convert to full language code
  const langMap = {
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'ru': 'ru-RU',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ar': 'ar-SA',
    'hi': 'hi-IN'
  }

  const fullLangCode = detectedLang ? langMap[detectedLang] : null

  if (fullLangCode && fullLangCode !== userLanguage.value) {
    console.log(`🌍 Language detected: ${fullLangCode} (different from selected: ${userLanguage.value})`)
  }

  return fullLangCode
}

// Volume control functions
const setInputVolume = (volume) => {
  inputVolume.value = volume

  // Apply volume to gain node if available
  if (window.audioGainNode) {
    const gain = volume / 100
    window.audioGainNode.gain.setValueAtTime(gain, window.audioGainNode.context.currentTime)
    console.log(`🎚️ Input volume set to ${volume}%`)
  }
}

const setOutputVolume = (volume) => {
  outputVolume.value = volume

  // Apply volume to remote audio element
  const audioElement = document.getElementById('remote-audio')
  if (audioElement) {
    audioElement.volume = volume / 100
    console.log(`🔊 Output volume set to ${volume}%`)
  }
}

const setMicrophoneSensitivity = (sensitivity) => {
  microphoneSensitivity.value = sensitivity

  // Adjust microphone gain
  if (window.audioGainNode) {
    const gain = (sensitivity / 100) * 2 // 0-2x gain
    window.audioGainNode.gain.setValueAtTime(gain, window.audioGainNode.context.currentTime)
    console.log(`🎤 Microphone sensitivity set to ${sensitivity}%`)
  }
}

const toggleNoiseReduction = () => {
  noiseReduction.value = !noiseReduction.value
  console.log(`🔇 Noise reduction ${noiseReduction.value ? 'enabled' : 'disabled'}`)

  // Restart audio stream with new settings
  if (localStream.value) {
    restartAudioStream()
  }
}

const toggleEchoCancellation = () => {
  echoCancellation.value = !echoCancellation.value
  console.log(`📢 Echo cancellation ${echoCancellation.value ? 'enabled' : 'disabled'}`)

  // Restart audio stream with new settings
  if (localStream.value) {
    restartAudioStream()
  }
}

// Advanced audio quality presets
const setAudioPreset = (preset) => {
  switch (preset) {
    case 'music':
      audioQuality.value = 'high'
      noiseReduction.value = false
      echoCancellation.value = true
      inputVolume.value = 90
      outputVolume.value = 85
      break
    case 'voice':
      audioQuality.value = 'standard'
      noiseReduction.value = true
      echoCancellation.value = true
      inputVolume.value = 80
      outputVolume.value = 80
      break
    case 'low-bandwidth':
      audioQuality.value = 'standard'
      noiseReduction.value = true
      echoCancellation.value = true
      inputVolume.value = 70
      outputVolume.value = 75
      break
    case 'high-quality':
      audioQuality.value = 'high'
      noiseReduction.value = true
      echoCancellation.value = true
      inputVolume.value = 85
      outputVolume.value = 85
      break
  }

  console.log(`🎛️ Audio preset applied: ${preset}`)

  // Apply changes
  setInputVolume(inputVolume.value)
  setOutputVolume(outputVolume.value)
  setAudioQuality(audioQuality.value)
}

// Auto-adjust audio based on environment
const autoAdjustAudio = () => {
  // This would typically use machine learning or heuristics
  // For now, we'll use simple rules based on connection quality

  if (connectionQuality.value === 'poor') {
    setAudioPreset('low-bandwidth')
  } else if (connectionQuality.value === 'excellent') {
    setAudioPreset('high-quality')
  } else {
    setAudioPreset('voice')
  }

  console.log(`🤖 Auto-adjusted audio for ${connectionQuality.value} connection`)
}

// Enhanced multi-API translation system with fallback and quality scoring
const translateText = async (text, fromLang, toLang) => {
  const fromCode = fromLang.split('-')[0]
  const toCode = toLang.split('-')[0]

  if (fromCode === toCode) return text

  // Check cache first
  const cacheKey = `${fromCode}-${toCode}-${text.toLowerCase()}`
  const cachedTranslation = getTranslationFromCache(cacheKey)
  if (cachedTranslation) {
    console.log('📋 Using cached translation')
    return cachedTranslation
  }

  const translationAPIs = [
    {
      name: 'MyMemory',
      translate: translateWithMyMemory,
      priority: 1,
      rateLimit: 1000, // requests per day
      quality: 0.8
    },
    {
      name: 'LibreTranslate',
      translate: translateWithLibreTranslate,
      priority: 2,
      rateLimit: 100,
      quality: 0.7
    },
    {
      name: 'GoogleTranslate',
      translate: translateWithGoogleTranslate,
      priority: 3,
      rateLimit: 500,
      quality: 0.9
    },
    {
      name: 'FallbackDictionary',
      translate: translateWithDictionary,
      priority: 4,
      rateLimit: Infinity,
      quality: 0.5
    }
  ]

  // Sort APIs by priority and availability
  const availableAPIs = translationAPIs
    .filter(api => isAPIAvailable(api.name))
    .sort((a, b) => a.priority - b.priority)

  let bestTranslation = null
  let bestQuality = 0
  let errors = []

  for (const api of availableAPIs) {
    try {
      console.log(`🔄 Trying ${api.name} API...`)

      const startTime = Date.now()
      const translation = await api.translate(text, fromCode, toCode)
      const responseTime = Date.now() - startTime

      if (translation && !translation.includes('[Translation unavailable')) {
        // Calculate quality score
        const qualityScore = calculateTranslationQuality(translation, api.quality, responseTime)

        console.log(`✅ ${api.name} translation: "${translation}" (quality: ${qualityScore})`)

        if (qualityScore > bestQuality) {
          bestTranslation = translation
          bestQuality = qualityScore
        }

        // If quality is good enough, use it immediately
        if (qualityScore > 0.8) {
          cacheTranslation(cacheKey, translation, qualityScore)
          return translation
        }
      }
    } catch (error) {
      console.warn(`❌ ${api.name} failed:`, error.message)
      errors.push({ api: api.name, error: error.message })

      // Mark API as temporarily unavailable
      markAPIUnavailable(api.name, 60000) // 1 minute timeout
    }
  }

  if (bestTranslation) {
    cacheTranslation(cacheKey, bestTranslation, bestQuality)
    return bestTranslation
  }

  // All APIs failed
  console.error('🚨 All translation APIs failed:', errors)
  return `[Translation failed: ${text}]`
}

// MyMemory API implementation
const translateWithMyMemory = async (text, fromCode, toCode) => {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromCode}|${toCode}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText
  }

  throw new Error('Invalid response format')
}

// LibreTranslate API implementation (self-hosted or public instance)
const translateWithLibreTranslate = async (text, fromCode, toCode) => {
  // Using public LibreTranslate instance (you can change this to your own)
  const url = 'https://libretranslate.de/translate'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      source: fromCode,
      target: toCode,
      format: 'text'
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (data.translatedText) {
    return data.translatedText
  }

  throw new Error('Invalid response format')
}

// Google Translate API implementation (requires API key)
const translateWithGoogleTranslate = async (text, fromCode, toCode) => {
  // Note: This requires a Google Cloud API key
  // For demo purposes, we'll simulate the API
  throw new Error('Google Translate API key required')

  // Uncomment and configure when you have an API key:
  /*
  const apiKey = 'YOUR_GOOGLE_TRANSLATE_API_KEY'
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      source: fromCode,
      target: toCode,
      format: 'text'
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (data.data?.translations?.[0]?.translatedText) {
    return data.data.translations[0].translatedText
  }

  throw new Error('Invalid response format')
  */
}

// Enhanced fallback dictionary
const translateWithDictionary = async (text, fromCode, toCode) => {
  const commonPhrases = {
    'en|es': {
      'hello': 'hola',
      'hi': 'hola',
      'thank you': 'gracias',
      'thanks': 'gracias',
      'how are you': 'cómo estás',
      'good morning': 'buenos días',
      'good afternoon': 'buenas tardes',
      'good evening': 'buenas noches',
      'goodbye': 'adiós',
      'yes': 'sí',
      'no': 'no',
      'please': 'por favor',
      'excuse me': 'disculpe',
      'sorry': 'lo siento'
    },
    'es|en': {
      'hola': 'hello',
      'gracias': 'thank you',
      'cómo estás': 'how are you',
      'buenos días': 'good morning',
      'buenas tardes': 'good afternoon',
      'buenas noches': 'good evening',
      'adiós': 'goodbye',
      'sí': 'yes',
      'no': 'no',
      'por favor': 'please',
      'disculpe': 'excuse me',
      'lo siento': 'sorry'
    },
    'en|fr': {
      'hello': 'bonjour',
      'hi': 'salut',
      'thank you': 'merci',
      'thanks': 'merci',
      'how are you': 'comment allez-vous',
      'good morning': 'bonjour',
      'good evening': 'bonsoir',
      'goodbye': 'au revoir',
      'yes': 'oui',
      'no': 'non',
      'please': 's\'il vous plaît',
      'excuse me': 'excusez-moi',
      'sorry': 'désolé'
    },
    'fr|en': {
      'bonjour': 'hello',
      'salut': 'hi',
      'merci': 'thank you',
      'comment allez-vous': 'how are you',
      'bonsoir': 'good evening',
      'au revoir': 'goodbye',
      'oui': 'yes',
      'non': 'no',
      's\'il vous plaît': 'please',
      'excusez-moi': 'excuse me',
      'désolé': 'sorry'
    }
  }

  const langPair = `${fromCode}|${toCode}`
  const phrases = commonPhrases[langPair]

  if (phrases) {
    const lowerText = text.toLowerCase().trim()

    // Exact match first
    if (phrases[lowerText]) {
      return phrases[lowerText]
    }

    // Partial match
    for (const [original, translated] of Object.entries(phrases)) {
      if (lowerText.includes(original.toLowerCase())) {
        return translated
      }
    }
  }

  throw new Error('No dictionary translation found')
}

// Enhanced translation caching and optimization system
const translationCache = new Map()
const apiAvailability = new Map()
const persistentCache = {
  // Use localStorage for persistent caching
  save() {
    try {
      const cacheData = Array.from(translationCache.entries()).map(([key, value]) => [key, value])
      localStorage.setItem('translationCache', JSON.stringify(cacheData))
      console.log('💾 Translation cache saved to localStorage')
    } catch (error) {
      console.warn('Failed to save translation cache:', error)
    }
  },

  load() {
    try {
      const cacheData = localStorage.getItem('translationCache')
      if (cacheData) {
        const entries = JSON.parse(cacheData)
        entries.forEach(([key, value]) => {
          // Only load recent cache entries (last 7 days)
          if (Date.now() - value.timestamp < 7 * 24 * 60 * 60 * 1000) {
            translationCache.set(key, value)
          }
        })
        console.log(`📋 Loaded ${translationCache.size} cached translations`)
      }
    } catch (error) {
      console.warn('Failed to load translation cache:', error)
    }
  },

  clear() {
    translationCache.clear()
    localStorage.removeItem('translationCache')
    console.log('🗑️ Translation cache cleared')
  }
}

const calculateTranslationQuality = (translation, baseQuality, responseTime) => {
  let quality = baseQuality

  // Penalize slow responses
  if (responseTime > 5000) quality -= 0.2
  else if (responseTime > 2000) quality -= 0.1

  // Penalize very short or very long translations
  const length = translation.length
  if (length < 3) quality -= 0.3
  else if (length > 500) quality -= 0.1

  // Penalize translations that look like errors
  if (translation.includes('error') || translation.includes('failed')) {
    quality -= 0.5
  }

  return Math.max(0, Math.min(1, quality))
}

const cacheTranslation = (key, translation, quality) => {
  translationCache.set(key, {
    translation,
    quality,
    timestamp: Date.now(),
    uses: 1,
    lastUsed: Date.now()
  })

  // Intelligent cache management
  if (translationCache.size > 1000) {
    cleanupCache()
  }

  // Periodically save to persistent storage
  if (Math.random() < 0.1) { // 10% chance to save
    persistentCache.save()
  }
}

// Intelligent cache cleanup
const cleanupCache = () => {
  const entries = Array.from(translationCache.entries())

  // Sort by usage frequency and recency
  entries.sort((a, b) => {
    const scoreA = a[1].uses * (1 / (Date.now() - a[1].lastUsed))
    const scoreB = b[1].uses * (1 / (Date.now() - b[1].lastUsed))
    return scoreB - scoreA
  })

  // Keep top 800 entries
  translationCache.clear()
  entries.slice(0, 800).forEach(([key, value]) => {
    translationCache.set(key, value)
  })

  console.log('🧹 Cache cleaned up, kept 800 most valuable entries')
}

const getTranslationFromCache = (key) => {
  const cached = translationCache.get(key)
  if (cached) {
    // Check if cache is still valid (7 days for frequently used, 24 hours for others)
    const maxAge = cached.uses > 5 ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    const age = Date.now() - cached.timestamp

    if (age < maxAge) {
      cached.uses++
      cached.lastUsed = Date.now()
      return cached.translation
    } else {
      translationCache.delete(key)
    }
  }
  return null
}

const isAPIAvailable = (apiName) => {
  const availability = apiAvailability.get(apiName)
  if (availability && availability.unavailableUntil > Date.now()) {
    return false
  }
  return true
}

const markAPIUnavailable = (apiName, timeoutMs) => {
  apiAvailability.set(apiName, {
    unavailableUntil: Date.now() + timeoutMs,
    failures: (apiAvailability.get(apiName)?.failures || 0) + 1
  })
}

// Translation statistics and monitoring
const translationStats = {
  totalTranslations: 0,
  successfulTranslations: 0,
  failedTranslations: 0,
  averageResponseTime: 0,
  apiUsage: {},

  recordTranslation(apiName, success, responseTime) {
    this.totalTranslations++

    if (success) {
      this.successfulTranslations++
    } else {
      this.failedTranslations++
    }

    // Update average response time
    this.averageResponseTime = (this.averageResponseTime + responseTime) / 2

    // Update API usage stats
    if (!this.apiUsage[apiName]) {
      this.apiUsage[apiName] = { success: 0, failed: 0, totalTime: 0 }
    }

    if (success) {
      this.apiUsage[apiName].success++
    } else {
      this.apiUsage[apiName].failed++
    }

    this.apiUsage[apiName].totalTime += responseTime
  },

  getSuccessRate() {
    return this.totalTranslations > 0 ?
      (this.successfulTranslations / this.totalTranslations) * 100 : 0
  },

  getBestAPI() {
    let bestAPI = null
    let bestScore = 0

    for (const [apiName, stats] of Object.entries(this.apiUsage)) {
      const total = stats.success + stats.failed
      if (total > 0) {
        const successRate = stats.success / total
        const avgTime = stats.totalTime / total
        const score = successRate * (1000 / Math.max(avgTime, 100)) // Favor fast, reliable APIs

        if (score > bestScore) {
          bestScore = score
          bestAPI = apiName
        }
      }
    }

    return bestAPI
  },

  // Performance optimization methods
  getOptimalAPI(fromLang, toLang) {
    const langPair = `${fromLang}-${toLang}`
    const apiPerformance = {}

    for (const [apiName, stats] of Object.entries(this.apiUsage)) {
      if (stats.success > 0) {
        const successRate = stats.success / (stats.success + stats.failed)
        const avgTime = stats.totalTime / stats.success
        const score = successRate * (1000 / Math.max(avgTime, 100))
        apiPerformance[apiName] = score
      }
    }

    return Object.entries(apiPerformance)
      .sort(([,a], [,b]) => b - a)
      .map(([api]) => api)
  },

  shouldUseCache(text, fromLang, toLang) {
    // Use cache more aggressively for common phrases
    const commonPhrases = ['hello', 'thank you', 'goodbye', 'yes', 'no', 'please']
    const isCommon = commonPhrases.some(phrase =>
      text.toLowerCase().includes(phrase.toLowerCase())
    )

    return isCommon || text.length < 50 || this.totalTranslations > 10
  }
}

// Translation performance optimizer
const translationOptimizer = {
  // Pre-translate common phrases
  preloadCommonPhrases() {
    const commonPhrases = [
      'hello', 'hi', 'thank you', 'thanks', 'goodbye', 'bye',
      'yes', 'no', 'please', 'excuse me', 'sorry',
      'how are you', 'good morning', 'good evening',
      'nice to meet you', 'see you later'
    ]

    const languages = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-PT']

    // Pre-translate between common language pairs
    languages.forEach(fromLang => {
      languages.forEach(toLang => {
        if (fromLang !== toLang) {
          commonPhrases.forEach(async phrase => {
            const cacheKey = `${fromLang.split('-')[0]}-${toLang.split('-')[0]}-${phrase.toLowerCase()}`
            if (!getTranslationFromCache(cacheKey)) {
              try {
                const translation = await translateText(phrase, fromLang, toLang)
                if (translation && !translation.includes('[Translation')) {
                  cacheTranslation(cacheKey, translation, 0.9)
                }
              } catch (error) {
                // Ignore preload errors
              }
            }
          })
        }
      })
    })

    console.log('🚀 Common phrases preloading initiated')
  },

  // Optimize translation request batching
  batchTranslations: [],
  batchTimeout: null,

  addToBatch(text, fromLang, toLang, callback) {
    this.batchTranslations.push({ text, fromLang, toLang, callback })

    // Process batch after short delay to collect multiple requests
    if (this.batchTimeout) clearTimeout(this.batchTimeout)
    this.batchTimeout = setTimeout(() => {
      this.processBatch()
    }, 100) // 100ms delay
  },

  async processBatch() {
    if (this.batchTranslations.length === 0) return

    const batch = [...this.batchTranslations]
    this.batchTranslations = []

    console.log(`📦 Processing translation batch of ${batch.size} items`)

    // Process translations in parallel
    const promises = batch.map(async item => {
      try {
        const translation = await translateText(item.text, item.fromLang, item.toLang)
        item.callback(null, translation)
      } catch (error) {
        item.callback(error, null)
      }
    })

    await Promise.allSettled(promises)
  }
}

// Initialize optimization features
const initializeTranslationOptimization = () => {
  // Load persistent cache
  persistentCache.load()

  // Preload common phrases in background
  setTimeout(() => {
    translationOptimizer.preloadCommonPhrases()
  }, 2000)

  // Save cache periodically
  setInterval(() => {
    persistentCache.save()
  }, 5 * 60 * 1000) // Every 5 minutes

  console.log('⚡ Translation optimization initialized')
}

// Smart Status System Functions
const updateSmartStatus = (type, message, progress = 0, details = '') => {
  smartStatus.value = {
    type,
    message,
    progress,
    details,
    timestamp: Date.now()
  }

  // Auto-clear status after certain time for non-persistent states
  if (['success', 'error', 'warning'].includes(type)) {
    setTimeout(() => {
      if (smartStatus.value.timestamp === smartStatus.value.timestamp) {
        smartStatus.value.type = 'idle'
        smartStatus.value.message = ''
      }
    }, 3000)
  }

  console.log(`📊 Status: ${type} - ${message}`)
}

const setLoadingState = (state, isLoading) => {
  loadingStates.value[state] = isLoading

  if (isLoading) {
    switch (state) {
      case 'initializing':
        updateSmartStatus('loading', 'Initializing application...', 20)
        break
      case 'connecting':
        updateSmartStatus('loading', 'Establishing connection...', 40)
        break
      case 'translating':
        updateSmartStatus('processing', 'Translating message...', 60)
        break
      case 'speaking':
        updateSmartStatus('speaking', 'Playing audio...', 80)
        break
      case 'reconnecting':
        updateSmartStatus('warning', 'Reconnecting...', 30)
        break
    }
  }
}

// Typing indicator management
const startTyping = () => {
  if (!typingIndicator.value.isTyping) {
    typingIndicator.value = {
      isTyping: true,
      user: currentUser.value?.name || 'User',
      startTime: Date.now()
    }

    // Emit typing status to other user
    if (socket.value && otherUser.value) {
      socket.value.emit('typing-start', {
        userId: currentUser.value?.userId,
        userName: currentUser.value?.name
      })
    }
  }
}

const stopTyping = () => {
  if (typingIndicator.value.isTyping) {
    typingIndicator.value.isTyping = false

    // Emit stop typing to other user
    if (socket.value && otherUser.value) {
      socket.value.emit('typing-stop', {
        userId: currentUser.value?.userId
      })
    }
  }
}

// Auto-stop typing after inactivity
let typingTimeout = null
const handleTypingActivity = () => {
  startTyping()

  if (typingTimeout) clearTimeout(typingTimeout)
  typingTimeout = setTimeout(() => {
    stopTyping()
  }, 2000) // Stop typing after 2 seconds of inactivity
}

// Connection health monitoring
const updateConnectionHealth = () => {
  if (!peerConnection.value) return

  peerConnection.value.getStats().then(stats => {
    let latency = 0
    let packetLoss = 0
    let bandwidth = 0

    stats.forEach(report => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        latency = report.currentRoundTripTime * 1000 || 0
      }

      if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
        const packetsLost = report.packetsLost || 0
        const packetsReceived = report.packetsReceived || 0
        packetLoss = packetsLost / (packetsLost + packetsReceived) * 100
        bandwidth = report.bytesReceived || 0
      }
    })

    // Update connection health
    connectionHealth.value = {
      status: getConnectionStatus(latency, packetLoss),
      latency: Math.round(latency),
      packetLoss: Math.round(packetLoss * 100) / 100,
      bandwidth: Math.round(bandwidth / 1024), // KB
      lastCheck: Date.now()
    }

    // Update global latency for compatibility
    latency.value = connectionHealth.value.latency
    connectionQuality.value = connectionHealth.value.status

  }).catch(error => {
    console.warn('Failed to get connection stats:', error)
  })
}

const getConnectionStatus = (latency, packetLoss) => {
  if (latency > 1000 || packetLoss > 5) return 'poor'
  if (latency > 500 || packetLoss > 2) return 'fair'
  if (latency > 200 || packetLoss > 0.5) return 'good'
  return 'excellent'
}

// Enhanced status update function
const sendStatusUpdate = (status) => {
  if (socket.value) {
    socket.value.emit('user-status', {
      userId: currentUser.value?.userId,
      ...status,
      timestamp: Date.now(),
      connectionHealth: connectionHealth.value
    })
  }

  // Update local smart status
  updateSmartStatus(status.type, status.message || '', status.progress || 0)
}

// Enhanced Chat Interface Functions
const searchMessages = (query) => {
  if (!query.trim()) {
    chatInterface.value.searchResults = []
    chatInterface.value.isSearching = false
    return
  }

  chatInterface.value.isSearching = true
  chatInterface.value.searchQuery = query.toLowerCase()

  const results = messages.value.filter(message => {
    const searchText = chatInterface.value.searchQuery

    // Search in original text
    if (message.text && message.text.toLowerCase().includes(searchText)) {
      return true
    }

    // Search in translated text
    if (message.translatedText && message.translatedText.toLowerCase().includes(searchText)) {
      return true
    }

    // Search in user names
    if (message.user?.name && message.user.name.toLowerCase().includes(searchText)) {
      return true
    }

    return false
  })

  chatInterface.value.searchResults = results
  chatInterface.value.isSearching = false

  console.log(`🔍 Found ${results.length} messages matching "${query}"`)
}

const filterMessages = (filterType) => {
  chatInterface.value.filterBy = filterType

  let filtered = [...messages.value]

  switch (filterType) {
    case 'original':
      filtered = filtered.filter(msg => msg.type === 'original')
      break
    case 'translation':
      filtered = filtered.filter(msg => msg.type === 'translation')
      break
    case 'errors':
      filtered = filtered.filter(msg => msg.type === 'error' || (msg.confidence && msg.confidence < 0.5))
      break
    case 'all':
    default:
      // No filtering
      break
  }

  return filtered
}

const sortMessages = (sortType) => {
  chatInterface.value.sortBy = sortType

  let sorted = [...messages.value]

  switch (sortType) {
    case 'oldest':
      sorted.sort((a, b) => a.timestamp - b.timestamp)
      break
    case 'relevance':
      if (chatInterface.value.searchResults.length > 0) {
        sorted = [...chatInterface.value.searchResults]
      }
      break
    case 'newest':
    default:
      sorted.sort((a, b) => b.timestamp - a.timestamp)
      break
  }

  return sorted
}

const getFilteredAndSortedMessages = () => {
  if (chatInterface.value.searchResults.length > 0 && chatInterface.value.searchQuery) {
    return chatInterface.value.searchResults
  }

  let processed = filterMessages(chatInterface.value.filterBy)
  processed = sortMessages(chatInterface.value.sortBy)

  return processed
}

const highlightSearchText = (text, query) => {
  if (!query || !text) return text

  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-300 text-black">$1</mark>')
}

const selectMessage = (message) => {
  chatInterface.value.selectedMessage = message

  // Scroll to message if needed
  const messageElement = document.getElementById(`message-${message.id}`)
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const clearSearch = () => {
  chatInterface.value.searchQuery = ''
  chatInterface.value.searchResults = []
  chatInterface.value.isSearching = false
  chatInterface.value.selectedMessage = null
}

const toggleSearchPanel = () => {
  chatInterface.value.showSearch = !chatInterface.value.showSearch

  if (!chatInterface.value.showSearch) {
    clearSearch()
  }
}

// Message statistics and insights
const getConversationStats = () => {
  const stats = {
    totalMessages: messages.value.length,
    originalMessages: messages.value.filter(m => m.type === 'original').length,
    translations: messages.value.filter(m => m.type === 'translation').length,
    averageConfidence: 0,
    languagesUsed: new Set(),
    topicsDiscussed: [],
    conversationDuration: 0
  }

  if (messages.value.length > 0) {
    // Calculate average confidence
    const confidenceMessages = messages.value.filter(m => m.confidence)
    if (confidenceMessages.length > 0) {
      stats.averageConfidence = confidenceMessages.reduce((sum, m) => sum + m.confidence, 0) / confidenceMessages.length
    }

    // Collect languages used
    messages.value.forEach(m => {
      if (m.language) stats.languagesUsed.add(m.language)
      if (m.sourceLanguage) stats.languagesUsed.add(m.sourceLanguage)
      if (m.targetLanguage) stats.languagesUsed.add(m.targetLanguage)
    })

    // Calculate conversation duration
    const firstMessage = messages.value[0]
    const lastMessage = messages.value[messages.value.length - 1]
    stats.conversationDuration = lastMessage.timestamp - firstMessage.timestamp

    // Extract topics from conversation context
    if (conversationContext.topics) {
      stats.topicsDiscussed = conversationContext.topics
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(t => t.name)
    }
  }

  return stats
}

const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

const exportConversation = () => {
  const stats = getConversationStats()
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      participants: [
        currentUser.value?.name || 'User 1',
        otherUser.value?.name || 'User 2'
      ],
      languages: Array.from(stats.languagesUsed),
      duration: formatDuration(stats.conversationDuration),
      messageCount: stats.totalMessages
    },
    statistics: stats,
    messages: messages.value.map(msg => ({
      id: msg.id,
      type: msg.type,
      text: msg.text || msg.translatedText,
      originalText: msg.originalText,
      translatedText: msg.translatedText,
      language: msg.language || msg.sourceLanguage,
      targetLanguage: msg.targetLanguage,
      confidence: msg.confidence,
      timestamp: new Date(msg.timestamp).toISOString(),
      user: msg.user?.name || 'Unknown'
    }))
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conversation-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  console.log('📄 Conversation exported successfully')
}

// Connection Optimization Functions
const detectNetworkType = () => {
  if ('connection' in navigator) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (connection) {
      connectionOptimization.value.networkType = connection.effectiveType || 'unknown'
      console.log(`📡 Network type detected: ${connectionOptimization.value.networkType}`)

      // Adjust settings based on network type
      adaptToNetworkConditions(connection.effectiveType)
    }
  }
}

const adaptToNetworkConditions = (networkType) => {
  if (!connectionOptimization.value.adaptiveQuality) return

  switch (networkType) {
    case 'slow-2g':
    case '2g':
      // Very poor connection - minimal quality
      setAudioQuality('standard')
      inputVolume.value = 60
      outputVolume.value = 60
      console.log('📶 Adapted to poor network: reduced quality')
      break

    case '3g':
      // Moderate connection - balanced quality
      setAudioQuality('standard')
      inputVolume.value = 70
      outputVolume.value = 70
      console.log('📶 Adapted to moderate network: standard quality')
      break

    case '4g':
    case '5g':
      // Good connection - high quality
      setAudioQuality('high')
      inputVolume.value = 80
      outputVolume.value = 80
      console.log('📶 Adapted to good network: high quality')
      break

    default:
      // Unknown - use safe defaults
      setAudioQuality('standard')
      console.log('📶 Unknown network: using safe defaults')
  }
}

const monitorBandwidth = async () => {
  if (!connectionOptimization.value.bandwidthMonitoring) return

  const now = Date.now()
  if (now - connectionOptimization.value.lastBandwidthCheck < 10000) return // Check every 10 seconds

  connectionOptimization.value.lastBandwidthCheck = now

  try {
    // Simple bandwidth test using a small image
    const startTime = performance.now()
    const response = await fetch('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', {
      cache: 'no-cache'
    })
    const endTime = performance.now()

    const latency = endTime - startTime

    // Update connection stability based on latency
    if (latency < 100) {
      connectionOptimization.value.connectionStability = 'stable'
    } else if (latency < 500) {
      connectionOptimization.value.connectionStability = 'unstable'
    } else {
      connectionOptimization.value.connectionStability = 'poor'
    }

    console.log(`📊 Bandwidth check: ${latency}ms latency, stability: ${connectionOptimization.value.connectionStability}`)

  } catch (error) {
    console.warn('Failed to monitor bandwidth:', error)
    connectionOptimization.value.connectionStability = 'poor'
  }
}

const attemptReconnection = async () => {
  if (connectionOptimization.value.isReconnecting) return
  if (connectionOptimization.value.reconnectAttempts >= connectionOptimization.value.maxReconnectAttempts) {
    console.error('🚨 Max reconnection attempts reached')
    updateSmartStatus('error', 'Connection failed. Please refresh the page.', 0)
    return
  }

  connectionOptimization.value.isReconnecting = true
  connectionOptimization.value.reconnectAttempts++

  const attempt = connectionOptimization.value.reconnectAttempts
  const delay = connectionOptimization.value.reconnectDelay * Math.pow(2, attempt - 1) // Exponential backoff

  updateSmartStatus('warning', `Reconnecting... (attempt ${attempt}/${connectionOptimization.value.maxReconnectAttempts})`,
                   (attempt / connectionOptimization.value.maxReconnectAttempts) * 100)

  console.log(`🔄 Reconnection attempt ${attempt} in ${delay}ms`)

  await new Promise(resolve => setTimeout(resolve, delay))

  try {
    // Attempt to reconnect socket
    if (socket.value) {
      socket.value.disconnect()
    }

    await initSocket()

    // If we had a room, try to rejoin
    if (room.value) {
      await rejoinRoom()
    }

    connectionOptimization.value.isReconnecting = false
    connectionOptimization.value.reconnectAttempts = 0
    updateSmartStatus('success', 'Reconnected successfully!', 100)

    console.log('✅ Reconnection successful')

  } catch (error) {
    console.error(`❌ Reconnection attempt ${attempt} failed:`, error)
    connectionOptimization.value.isReconnecting = false

    // Try again if we haven't reached max attempts
    if (attempt < connectionOptimization.value.maxReconnectAttempts) {
      setTimeout(() => attemptReconnection(), 1000)
    }
  }
}

const rejoinRoom = async () => {
  if (!room.value || !currentUser.value) return

  try {
    console.log('🔄 Attempting to rejoin room:', room.value.id)

    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Rejoin timeout')), 10000)

      socket.value.emit('join-room', {
        roomCode: room.value.id,
        userName: currentUser.value.name,
        userLanguage: userLanguage.value
      })

      socket.value.once('room-joined', (data) => {
        clearTimeout(timeout)
        resolve(data)
      })

      socket.value.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    room.value = response.room
    currentUser.value = response.user
    updateOtherUser()

    // Reinitialize WebRTC if needed
    if (otherUser.value) {
      await initWebRTC()
    }

    console.log('✅ Successfully rejoined room')

  } catch (error) {
    console.error('❌ Failed to rejoin room:', error)
    throw error
  }
}

const optimizeConnectionSettings = () => {
  const stability = connectionOptimization.value.connectionStability
  const networkType = connectionOptimization.value.networkType

  // Adjust WebRTC settings based on connection quality
  if (peerConnection.value) {
    const configuration = peerConnection.value.getConfiguration()

    if (stability === 'poor' || networkType === '2g' || networkType === 'slow-2g') {
      // Use more aggressive ICE gathering for poor connections
      configuration.iceCandidatePoolSize = 20
      configuration.iceTransportPolicy = 'all'
    } else {
      // Standard settings for good connections
      configuration.iceCandidatePoolSize = 10
      configuration.iceTransportPolicy = 'all'
    }

    console.log('⚙️ Optimized WebRTC configuration for', stability, 'connection')
  }

  // Adjust translation caching based on connection
  if (stability === 'poor') {
    // More aggressive caching for poor connections
    translationOptimizer.batchTimeout = 500 // Longer batching
  } else {
    // Standard caching for good connections
    translationOptimizer.batchTimeout = 100
  }
}

const handleConnectionStateChange = (state) => {
  console.log('🔗 Connection state changed:', state)

  switch (state) {
    case 'disconnected':
    case 'failed':
      if (!connectionOptimization.value.isReconnecting) {
        attemptReconnection()
      }
      break

    case 'connected':
      connectionOptimization.value.reconnectAttempts = 0
      connectionOptimization.value.isReconnecting = false
      optimizeConnectionSettings()
      break

    case 'connecting':
      updateSmartStatus('loading', 'Establishing connection...', 30)
      break
  }
}

const enableConnectionOptimization = () => {
  // Detect network type
  detectNetworkType()

  // Monitor network changes
  if ('connection' in navigator) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (connection) {
      connection.addEventListener('change', () => {
        console.log('📡 Network conditions changed')
        detectNetworkType()
        monitorBandwidth()
      })
    }
  }

  // Monitor bandwidth periodically
  setInterval(monitorBandwidth, 15000) // Every 15 seconds

  // Monitor connection stability
  setInterval(() => {
    if (peerConnection.value) {
      updateConnectionHealth()
      optimizeConnectionSettings()
    }
  }, 5000) // Every 5 seconds

  console.log('⚡ Connection optimization enabled')
}

// Comprehensive Error Handling System
const handleError = (error, type = ErrorTypes.UNKNOWN, severity = ErrorSeverity.MEDIUM, context = {}) => {
  const errorObj = {
    id: Date.now() + Math.random(),
    type,
    severity,
    message: error.message || error.toString(),
    timestamp: Date.now(),
    context,
    stack: error.stack,
    userAgent: navigator.userAgent,
    url: window.location.href,
    resolved: false
  }

  errorHandling.value.errors.push(errorObj)
  errorHandling.value.lastError = errorObj
  errorHandling.value.errorCount++

  // Keep only last 50 errors
  if (errorHandling.value.errors.length > 50) {
    errorHandling.value.errors.shift()
  }

  console.error(`🚨 Error [${type}/${severity}]:`, error, context)

  // Handle based on severity
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      handleCriticalError(errorObj)
      break
    case ErrorSeverity.HIGH:
      handleHighSeverityError(errorObj)
      break
    case ErrorSeverity.MEDIUM:
      handleMediumSeverityError(errorObj)
      break
    case ErrorSeverity.LOW:
      handleLowSeverityError(errorObj)
      break
  }

  // Attempt automatic recovery
  attemptErrorRecovery(errorObj)

  return errorObj
}

const handleCriticalError = (error) => {
  updateSmartStatus('error', 'Critical error occurred. Please refresh the page.', 0)
  errorHandling.value.showErrorPanel = true

  // Log to external service (if available)
  logErrorToService(error)

  // Show user-friendly message
  showUserFriendlyError(error, 'A critical error occurred. The application may not function properly. Please refresh the page.')
}

const handleHighSeverityError = (error) => {
  updateSmartStatus('error', 'Error occurred. Attempting recovery...', 0)

  // Enable graceful degradation
  enableGracefulDegradation(error.type)

  // Show recovery options
  showRecoveryOptions(error)
}

const handleMediumSeverityError = (error) => {
  updateSmartStatus('warning', 'Minor issue detected. Continuing...', 0)

  // Show brief notification
  showBriefNotification(error)
}

const handleLowSeverityError = (error) => {
  // Just log, don't disturb user
  console.warn('⚠️ Low severity error:', error.message)
}

const attemptErrorRecovery = async (error) => {
  errorHandling.value.recoveryAttempts++

  try {
    switch (error.type) {
      case ErrorTypes.NETWORK:
        await recoverFromNetworkError(error)
        break
      case ErrorTypes.AUDIO:
        await recoverFromAudioError(error)
        break
      case ErrorTypes.TRANSLATION:
        await recoverFromTranslationError(error)
        break
      case ErrorTypes.PERMISSION:
        await recoverFromPermissionError(error)
        break
      case ErrorTypes.BROWSER:
        await recoverFromBrowserError(error)
        break
      default:
        await genericErrorRecovery(error)
    }

    error.resolved = true
    updateSmartStatus('success', 'Error resolved automatically', 100)

  } catch (recoveryError) {
    console.error('❌ Recovery failed:', recoveryError)
    handleError(recoveryError, ErrorTypes.UNKNOWN, ErrorSeverity.HIGH, { originalError: error })
  }
}

const recoverFromNetworkError = async (error) => {
  console.log('🔄 Attempting network error recovery...')

  // Try reconnection
  if (!isConnected.value) {
    await attemptReconnection()
  }

  // Enable offline mode if available
  if (!navigator.onLine) {
    enableOfflineMode()
  }
}

const recoverFromAudioError = async (error) => {
  console.log('🔄 Attempting audio error recovery...')

  // Try to reinitialize audio
  try {
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => track.stop())
    }
    await initWebRTC()
  } catch (retryError) {
    // Fall back to text-only mode
    errorHandling.value.gracefulDegradation.audioFallback = true
    updateSmartStatus('warning', 'Audio unavailable. Using text-only mode.', 0)
  }
}

const recoverFromTranslationError = async (error) => {
  console.log('🔄 Attempting translation error recovery...')

  // Try different translation API
  const context = error.context
  if (context.text && context.fromLang && context.toLang) {
    try {
      // Force use of fallback dictionary
      const fallbackTranslation = await translateWithDictionary(context.text, context.fromLang, context.toLang)
      return fallbackTranslation
    } catch (fallbackError) {
      errorHandling.value.gracefulDegradation.translationFallback = true
      updateSmartStatus('warning', 'Translation limited. Some features may not work.', 0)
    }
  }
}

const recoverFromPermissionError = async (error) => {
  console.log('🔄 Attempting permission error recovery...')

  // Show permission request guide
  showPermissionGuide(error.context.permission)
}

const recoverFromBrowserError = async (error) => {
  console.log('🔄 Attempting browser error recovery...')

  // Check browser compatibility
  const compatibility = checkBrowserCompatibility()
  if (!compatibility.isSupported) {
    showBrowserCompatibilityWarning(compatibility)
  }
}

const genericErrorRecovery = async (error) => {
  console.log('🔄 Attempting generic error recovery...')

  // Clear caches
  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
  }

  // Clear local storage (except important data)
  const importantKeys = ['translationCache', 'userPreferences']
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && !importantKeys.includes(key)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

const enableGracefulDegradation = (errorType) => {
  switch (errorType) {
    case ErrorTypes.AUDIO:
      errorHandling.value.gracefulDegradation.audioFallback = true
      updateSmartStatus('warning', 'Audio features disabled. Using text-only mode.', 0)
      break
    case ErrorTypes.TRANSLATION:
      errorHandling.value.gracefulDegradation.translationFallback = true
      updateSmartStatus('warning', 'Advanced translation disabled. Using basic translation.', 0)
      break
    case ErrorTypes.NETWORK:
      enableOfflineMode()
      break
  }
}

const enableOfflineMode = () => {
  errorHandling.value.gracefulDegradation.offlineMode = true
  updateSmartStatus('warning', 'Offline mode enabled. Limited functionality.', 0)

  // Disable features that require network
  connectionOptimization.value.bandwidthMonitoring = false

  console.log('📴 Offline mode enabled')
}

const showUserFriendlyError = (error, message) => {
  // This would show a user-friendly error dialog
  console.log('💬 User-friendly error:', message)
  updateSmartStatus('error', message, 0)
}

const showRecoveryOptions = (error) => {
  // This would show recovery options to the user
  console.log('🔧 Recovery options for:', error.type)
}

const showBriefNotification = (error) => {
  // This would show a brief notification
  console.log('📢 Brief notification:', error.message)
}

const showPermissionGuide = (permission) => {
  const guides = {
    microphone: 'Please allow microphone access in your browser settings to use voice features.',
    camera: 'Please allow camera access in your browser settings.',
    notifications: 'Please allow notifications to receive updates.'
  }

  const message = guides[permission] || 'Please check your browser permissions.'
  updateSmartStatus('warning', message, 0)
}

const checkBrowserCompatibility = () => {
  const features = {
    webrtc: !!(window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection),
    websockets: !!window.WebSocket,
    speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    speechSynthesis: !!window.speechSynthesis,
    mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  }

  const unsupportedFeatures = Object.entries(features)
    .filter(([, supported]) => !supported)
    .map(([feature]) => feature)

  return {
    isSupported: unsupportedFeatures.length === 0,
    unsupportedFeatures,
    browserInfo: {
      name: getBrowserName(),
      version: getBrowserVersion(),
      userAgent: navigator.userAgent
    }
  }
}

const getBrowserName = () => {
  const userAgent = navigator.userAgent
  if (userAgent.includes('Chrome')) return 'Chrome'
  if (userAgent.includes('Firefox')) return 'Firefox'
  if (userAgent.includes('Safari')) return 'Safari'
  if (userAgent.includes('Edge')) return 'Edge'
  return 'Unknown'
}

const getBrowserVersion = () => {
  const userAgent = navigator.userAgent
  const match = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/)
  return match ? match[2] : 'Unknown'
}

const showBrowserCompatibilityWarning = (compatibility) => {
  const message = `Your browser doesn't support: ${compatibility.unsupportedFeatures.join(', ')}. Please use a modern browser.`
  updateSmartStatus('error', message, 0)
}

const logErrorToService = (error) => {
  // This would log to an external error tracking service
  console.log('📊 Logging error to service:', error.id)

  // Example: Send to error tracking service
  // fetch('/api/errors', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(error)
  // }).catch(console.error)
}

const clearErrors = () => {
  errorHandling.value.errors = []
  errorHandling.value.errorCount = 0
  errorHandling.value.lastError = null
  errorHandling.value.showErrorPanel = false
}

const dismissError = (errorId) => {
  const index = errorHandling.value.errors.findIndex(e => e.id === errorId)
  if (index !== -1) {
    errorHandling.value.errors.splice(index, 1)
  }
}

// Global error handlers
const setupGlobalErrorHandlers = () => {
  // Unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    handleError(event.error || new Error(event.message), ErrorTypes.UNKNOWN, ErrorSeverity.HIGH, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, ErrorTypes.UNKNOWN, ErrorSeverity.HIGH, {
      promise: event.promise
    })
  })

  // Network status changes
  window.addEventListener('online', () => {
    console.log('🌐 Back online')
    errorHandling.value.gracefulDegradation.offlineMode = false
    updateSmartStatus('success', 'Connection restored', 100)
  })

  window.addEventListener('offline', () => {
    console.log('📴 Gone offline')
    enableOfflineMode()
  })

  console.log('🛡️ Global error handlers setup complete')
}

// Smart translation features with context awareness
const conversationContext = {
  messages: [],
  topics: [],
  userPreferences: {},
  culturalContext: {},

  addMessage(originalText, translatedText, fromLang, toLang) {
    this.messages.push({
      original: originalText,
      translated: translatedText,
      fromLang,
      toLang,
      timestamp: Date.now(),
      topics: this.extractTopics(originalText)
    })

    // Keep only last 50 messages for context
    if (this.messages.length > 50) {
      this.messages.shift()
    }

    this.updateTopics(originalText)
  },

  extractTopics(text) {
    // Simple topic extraction based on keywords
    const topicKeywords = {
      'food': ['eat', 'food', 'restaurant', 'hungry', 'meal', 'dinner', 'lunch', 'breakfast', 'cook', 'recipe'],
      'travel': ['travel', 'trip', 'vacation', 'hotel', 'flight', 'airport', 'train', 'bus', 'visit', 'tourism'],
      'work': ['work', 'job', 'office', 'meeting', 'project', 'business', 'company', 'colleague', 'boss', 'salary'],
      'family': ['family', 'mother', 'father', 'sister', 'brother', 'child', 'parent', 'relative', 'home'],
      'health': ['health', 'doctor', 'hospital', 'medicine', 'sick', 'pain', 'treatment', 'medical', 'pharmacy'],
      'education': ['school', 'university', 'student', 'teacher', 'study', 'learn', 'education', 'class', 'exam'],
      'technology': ['computer', 'internet', 'phone', 'app', 'software', 'technology', 'digital', 'online'],
      'weather': ['weather', 'rain', 'sun', 'snow', 'hot', 'cold', 'temperature', 'climate', 'forecast']
    }

    const lowerText = text.toLowerCase()
    const detectedTopics = []

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        detectedTopics.push(topic)
      }
    }

    return detectedTopics
  },

  updateTopics(text) {
    const newTopics = this.extractTopics(text)
    newTopics.forEach(topic => {
      const existing = this.topics.find(t => t.name === topic)
      if (existing) {
        existing.count++
        existing.lastMentioned = Date.now()
      } else {
        this.topics.push({
          name: topic,
          count: 1,
          lastMentioned: Date.now()
        })
      }
    })
  },

  getRecentTopics(limit = 3) {
    return this.topics
      .sort((a, b) => b.lastMentioned - a.lastMentioned)
      .slice(0, limit)
      .map(t => t.name)
  },

  getContextForTranslation(text, fromLang, toLang) {
    const recentMessages = this.messages.slice(-5) // Last 5 messages
    const recentTopics = this.getRecentTopics()

    return {
      recentMessages,
      recentTopics,
      conversationLength: this.messages.length,
      dominantLanguages: this.getDominantLanguages(),
      culturalHints: this.getCulturalHints(fromLang, toLang)
    }
  },

  getDominantLanguages() {
    const langCounts = {}
    this.messages.forEach(msg => {
      langCounts[msg.fromLang] = (langCounts[msg.fromLang] || 0) + 1
      langCounts[msg.toLang] = (langCounts[msg.toLang] || 0) + 1
    })

    return Object.entries(langCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([lang]) => lang)
  },

  getCulturalHints(fromLang, toLang) {
    const culturalNotes = {
      'en-US': {
        formality: 'casual',
        directness: 'high',
        timeOrientation: 'future',
        notes: 'Americans tend to be direct and informal in communication'
      },
      'ja-JP': {
        formality: 'high',
        directness: 'low',
        timeOrientation: 'present',
        notes: 'Japanese communication values politeness and indirect expression'
      },
      'de-DE': {
        formality: 'medium',
        directness: 'high',
        timeOrientation: 'future',
        notes: 'Germans value precision and directness in communication'
      },
      'es-ES': {
        formality: 'medium',
        directness: 'medium',
        timeOrientation: 'present',
        notes: 'Spanish communication is warm and relationship-focused'
      },
      'fr-FR': {
        formality: 'high',
        directness: 'medium',
        timeOrientation: 'past',
        notes: 'French communication values eloquence and cultural refinement'
      }
    }

    return {
      from: culturalNotes[fromLang] || { formality: 'medium', directness: 'medium' },
      to: culturalNotes[toLang] || { formality: 'medium', directness: 'medium' }
    }
  }
}

// Context-aware translation enhancement
const enhanceTranslationWithContext = async (originalText, translation, fromLang, toLang) => {
  const context = conversationContext.getContextForTranslation(originalText, fromLang, toLang)

  // Add conversation memory
  conversationContext.addMessage(originalText, translation, fromLang, toLang)

  // Apply cultural adaptations
  const culturallyAdaptedTranslation = applyCulturalAdaptation(
    translation,
    context.culturalHints,
    context.recentTopics
  )

  // Add context hints for the user
  const contextHints = generateContextHints(originalText, translation, context)

  return {
    translation: culturallyAdaptedTranslation,
    contextHints,
    confidence: calculateContextualConfidence(originalText, translation, context)
  }
}

// Apply cultural adaptations to translation
const applyCulturalAdaptation = (translation, culturalHints, topics) => {
  let adaptedTranslation = translation

  // Adjust formality level
  if (culturalHints.to.formality === 'high' && culturalHints.from.formality === 'casual') {
    adaptedTranslation = makeMoreFormal(adaptedTranslation)
  } else if (culturalHints.to.formality === 'casual' && culturalHints.from.formality === 'high') {
    adaptedTranslation = makeLessFormal(adaptedTranslation)
  }

  // Apply topic-specific adaptations
  if (topics.includes('business') || topics.includes('work')) {
    adaptedTranslation = applyBusinessContext(adaptedTranslation)
  }

  return adaptedTranslation
}

// Generate helpful context hints for users
const generateContextHints = (originalText, translation, context) => {
  const hints = []

  // Cultural context hints
  const culturalDiff = context.culturalHints
  if (culturalDiff.from.formality !== culturalDiff.to.formality) {
    hints.push({
      type: 'cultural',
      message: `Note: ${culturalDiff.to.formality} formality is preferred in the target culture`,
      icon: '🌍'
    })
  }

  // Topic continuity hints
  if (context.recentTopics.length > 0) {
    hints.push({
      type: 'topic',
      message: `Conversation topics: ${context.recentTopics.join(', ')}`,
      icon: '💭'
    })
  }

  // Translation confidence hints
  if (translation.length < originalText.length * 0.5) {
    hints.push({
      type: 'warning',
      message: 'Translation seems unusually short - please verify meaning',
      icon: '⚠️'
    })
  }

  return hints
}

// Simple formality adjustments (can be enhanced with ML models)
const makeMoreFormal = (text) => {
  return text
    .replace(/\bhi\b/gi, 'hello')
    .replace(/\bthanks\b/gi, 'thank you')
    .replace(/\byeah\b/gi, 'yes')
    .replace(/\bokay\b/gi, 'very well')
}

const makeLessFormal = (text) => {
  return text
    .replace(/\bhello\b/gi, 'hi')
    .replace(/\bthank you\b/gi, 'thanks')
    .replace(/\bvery well\b/gi, 'okay')
}

const applyBusinessContext = (text) => {
  // Add business-appropriate language adjustments
  return text
    .replace(/\bmeet\b/gi, 'meeting')
    .replace(/\btalk\b/gi, 'discuss')
}

const calculateContextualConfidence = (originalText, translation, context) => {
  let confidence = 0.7 // Base confidence

  // Increase confidence if we have conversation context
  if (context.conversationLength > 5) confidence += 0.1

  // Increase confidence if topics are consistent
  if (context.recentTopics.length > 0) confidence += 0.1

  // Decrease confidence for very short or long translations
  const lengthRatio = translation.length / originalText.length
  if (lengthRatio < 0.3 || lengthRatio > 3) confidence -= 0.2

  return Math.max(0.1, Math.min(1.0, confidence))
}

// Note: sendStatusUpdate function is defined earlier in the Smart Status System section

// Enhanced text-to-speech with voice selection and emotional tone
const speakText = (text, language, options = {}) => {
  if (!synthesis.value || !text || text.includes('[Translation unavailable')) return

  isSpeaking.value = true
  sendStatusUpdate({ type: 'speaking', message: 'Speaking...' })

  synthesis.value.cancel()

  const utterance = new SpeechSynthesisUtterance(text)

  // Enhanced voice selection
  const voice = selectOptimalVoice(language, options.gender, options.accent)
  if (voice) utterance.voice = voice

  // Apply voice settings based on context and user preferences
  const voiceSettings = calculateVoiceSettings(text, language, options)
  utterance.volume = (outputVolume.value / 100) * voiceSettings.volume
  utterance.rate = voiceSettings.rate
  utterance.pitch = voiceSettings.pitch

  // Add emotional tone if detected
  const emotionalTone = detectEmotionalTone(text)
  if (emotionalTone) {
    applyEmotionalTone(utterance, emotionalTone)
  }

  utterance.onstart = () => {
    console.log('🔊 Speaking:', text, 'Voice:', voice?.name, 'Settings:', voiceSettings)
  }

  utterance.onend = () => {
    isSpeaking.value = false
    sendStatusUpdate({ type: 'idle' })
  }

  utterance.onerror = (event) => {
    console.error('Speech synthesis error:', event.error)
    isSpeaking.value = false
    sendStatusUpdate({ type: 'idle' })
  }

  // Add speech events for better UX
  utterance.onboundary = (event) => {
    if (event.name === 'sentence') {
      // Could add visual indicators for sentence boundaries
    }
  }

  synthesis.value.speak(utterance)
}

// Enhanced voice selection with gender and accent preferences
const selectOptimalVoice = (languageCode, preferredGender = null, preferredAccent = null) => {
  if (!synthesis.value) return null

  const voices = synthesis.value.getVoices()
  const langCode = languageCode.split('-')[0]
  const fullLangCode = languageCode

  // Filter voices by language
  let candidateVoices = voices.filter(v =>
    v.lang.startsWith(langCode) || v.lang.startsWith(fullLangCode)
  )

  if (candidateVoices.length === 0) {
    candidateVoices = voices.filter(v => v.lang.startsWith('en')) // Fallback to English
  }

  if (candidateVoices.length === 0) {
    return voices[0] // Ultimate fallback
  }

  // Score voices based on preferences and quality
  const scoredVoices = candidateVoices.map(voice => {
    let score = 0

    // Prefer exact language match
    if (voice.lang === fullLangCode) score += 10
    else if (voice.lang.startsWith(langCode)) score += 5

    // Prefer local voices (usually higher quality)
    if (voice.localService) score += 3

    // Gender preference
    if (preferredGender) {
      const voiceName = voice.name.toLowerCase()
      if (preferredGender === 'female' && (voiceName.includes('female') || voiceName.includes('woman'))) {
        score += 2
      } else if (preferredGender === 'male' && (voiceName.includes('male') || voiceName.includes('man'))) {
        score += 2
      }
    }

    // Accent preference
    if (preferredAccent && voice.lang.includes(preferredAccent)) {
      score += 2
    }

    // Quality indicators in voice names
    const qualityIndicators = ['premium', 'enhanced', 'neural', 'natural']
    if (qualityIndicators.some(indicator => voice.name.toLowerCase().includes(indicator))) {
      score += 3
    }

    return { voice, score }
  })

  // Return the highest scored voice
  scoredVoices.sort((a, b) => b.score - a.score)
  return scoredVoices[0].voice
}

// Calculate optimal voice settings based on context
const calculateVoiceSettings = (text, language, options = {}) => {
  const settings = {
    volume: 1.0,
    rate: 0.9,
    pitch: 1.0
  }

  // Adjust rate based on language characteristics
  const languageRates = {
    'ja': 0.8, // Japanese typically spoken slower
    'zh': 0.8, // Chinese tones need careful pronunciation
    'ar': 0.85, // Arabic script complexity
    'de': 0.95, // German compound words
    'en': 1.0,
    'es': 1.05, // Spanish can be spoken faster
    'fr': 0.95,
    'it': 1.0
  }

  const langCode = language.split('-')[0]
  if (languageRates[langCode]) {
    settings.rate = languageRates[langCode]
  }

  // Adjust based on text length
  if (text.length > 100) {
    settings.rate *= 0.95 // Slightly slower for long text
  } else if (text.length < 20) {
    settings.rate *= 1.05 // Slightly faster for short text
  }

  // Adjust based on punctuation (emotional indicators)
  if (text.includes('!')) {
    settings.volume *= 1.1
    settings.pitch *= 1.05
  }
  if (text.includes('?')) {
    settings.pitch *= 1.1
  }

  // Apply user preferences
  if (options.rate) settings.rate = options.rate
  if (options.pitch) settings.pitch = options.pitch
  if (options.volume) settings.volume = options.volume

  // Ensure values are within valid ranges
  settings.volume = Math.max(0.1, Math.min(1.0, settings.volume))
  settings.rate = Math.max(0.1, Math.min(10.0, settings.rate))
  settings.pitch = Math.max(0.0, Math.min(2.0, settings.pitch))

  return settings
}

// Detect emotional tone in text
const detectEmotionalTone = (text) => {
  const emotionalIndicators = {
    excited: /[!]{2,}|wow|amazing|fantastic|incredible|awesome/gi,
    happy: /[😊😄😃🙂]|happy|joy|great|wonderful|excellent|good/gi,
    sad: /[😢😭😞]|sad|sorry|unfortunately|terrible|awful|bad/gi,
    angry: /[😠😡]|angry|mad|furious|annoyed|frustrated/gi,
    surprised: /[😮😲]|surprised|shocked|unexpected|wow|really/gi,
    questioning: /\?+|how|what|when|where|why|which/gi,
    urgent: /urgent|important|quickly|hurry|asap|emergency/gi
  }

  for (const [emotion, pattern] of Object.entries(emotionalIndicators)) {
    if (pattern.test(text)) {
      return emotion
    }
  }

  return null
}

// Apply emotional tone to speech utterance
const applyEmotionalTone = (utterance, emotion) => {
  switch (emotion) {
    case 'excited':
      utterance.rate *= 1.1
      utterance.pitch *= 1.1
      utterance.volume *= 1.05
      break
    case 'happy':
      utterance.pitch *= 1.05
      utterance.rate *= 1.02
      break
    case 'sad':
      utterance.rate *= 0.9
      utterance.pitch *= 0.95
      utterance.volume *= 0.9
      break
    case 'angry':
      utterance.volume *= 1.1
      utterance.rate *= 1.05
      break
    case 'surprised':
      utterance.pitch *= 1.15
      utterance.rate *= 0.95
      break
    case 'questioning':
      utterance.pitch *= 1.1
      break
    case 'urgent':
      utterance.rate *= 1.15
      utterance.volume *= 1.05
      break
  }
}

// Voice preference management
const voicePreferences = {
  gender: 'auto', // 'male', 'female', 'auto'
  accent: 'auto', // 'us', 'uk', 'au', 'auto'
  speed: 'normal', // 'slow', 'normal', 'fast'

  setGenderPreference(gender) {
    this.gender = gender
    console.log(`🎭 Voice gender preference set to: ${gender}`)
  },

  setAccentPreference(accent) {
    this.accent = accent
    console.log(`🗣️ Voice accent preference set to: ${accent}`)
  },

  setSpeedPreference(speed) {
    this.speed = speed
    console.log(`⚡ Voice speed preference set to: ${speed}`)
  }
}

// Get best voice for language (legacy function for compatibility)
const getBestVoice = (languageCode) => {
  return selectOptimalVoice(
    languageCode,
    voicePreferences.gender === 'auto' ? null : voicePreferences.gender,
    voicePreferences.accent === 'auto' ? null : voicePreferences.accent
  )
}

// Enhanced voice recording toggle with better error handling
const toggleVoiceRecording = async () => {
  if (!recognition.value) {
    connectionError.value = 'Speech recognition not supported in this browser'
    return
  }

  if (!otherUser.value) {
    connectionError.value = 'Please wait for another user to join'
    return
  }

  if (isListening.value) {
    // Stop recording
    try {
      recognition.value.stop()
      console.log('🛑 Stopping voice recording')
    } catch (error) {
      console.error('Error stopping recognition:', error)
      isListening.value = false
      sendStatusUpdate({ type: 'idle' })
    }
  } else {
    // Start recording
    try {
      // Check microphone permissions
      if (!localStream.value) {
        connectionError.value = 'Microphone not available. Please allow microphone access.'
        return
      }

      // Update language and start
      recognition.value.lang = userLanguage.value
      console.log(`🎤 Starting voice recording in ${userLanguage.value}`)

      // Clear any previous interim results
      currentMessage.value = ''

      recognition.value.start()
    } catch (error) {
      console.error('Error starting recognition:', error)
      handleSpeechRecognitionError(error.message || 'unknown')
    }
  }
}

// Enhanced voice recording with push-to-talk option
const startPushToTalk = () => {
  if (!isListening.value && !isProcessing.value) {
    toggleVoiceRecording()
  }
}

const stopPushToTalk = () => {
  if (isListening.value) {
    toggleVoiceRecording()
  }
}

// Keyboard shortcuts for voice control
const handleKeyboardShortcuts = (event) => {
  // Space bar for push-to-talk
  if (event.code === 'Space' && !event.repeat && otherUser.value) {
    event.preventDefault()

    if (event.type === 'keydown') {
      startPushToTalk()
    } else if (event.type === 'keyup') {
      stopPushToTalk()
    }
  }

  // Escape to stop any ongoing recording
  if (event.code === 'Escape' && isListening.value) {
    toggleVoiceRecording()
  }
}

// Send text message
const sendTextMessage = () => {
  if (!messageInput.value.trim() || !otherUser.value) return

  processVoiceMessage(messageInput.value.trim(), 1.0)
  messageInput.value = ''
}

// Scroll to bottom of messages
const scrollToBottom = () => {
  nextTick(() => {
    const messagesContainer = document.getElementById('messages-container')
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
  })
}

// Get language flag
const getLanguageFlag = (langCode) => {
  const lang = languages.find(l => l.code === langCode)
  return lang ? lang.flag : '🌍'
}

// Get language name
const getLanguageName = (langCode) => {
  const lang = languages.find(l => l.code === langCode)
  return lang ? lang.name : langCode
}

// Format timestamp
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Copy room code
const copyRoomCode = () => {
  navigator.clipboard.writeText(room.value.id)
  alert('Room code copied to clipboard!')
}

// Leave room
const leaveRoom = () => {
  // Clean up audio processing
  if (window.audioProcessingCleanup) {
    window.audioProcessingCleanup()
    window.audioProcessingCleanup = null
  }

  // Clear quality monitoring
  if (window.qualityMonitorInterval) {
    clearInterval(window.qualityMonitorInterval)
    window.qualityMonitorInterval = null
  }

  // Close WebRTC connection
  if (peerConnection.value) {
    peerConnection.value.close()
    peerConnection.value = null
  }

  // Stop local stream
  if (localStream.value) {
    localStream.value.getTracks().forEach(track => track.stop())
    localStream.value = null
  }

  // Clear remote stream
  remoteStream.value = null
  isAudioConnected.value = false

  if (socket.value) {
    socket.value.disconnect()
  }

  // Reset state
  showJoinForm.value = true
  currentUser.value = null
  room.value = null
  messages.value = []
  otherUser.value = null
  userStatus.value = {}
  roomCode.value = ''
  userName.value = ''

  // Reconnect socket
  setTimeout(() => {
    initSocket()
  }, 1000)
}

// Lifecycle hooks
onMounted(() => {
  initSocket()

  // Load voices when available
  if (window.speechSynthesis) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      console.log('✅ Voices loaded:', window.speechSynthesis.getVoices().length)
    })
  }

  // Add keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts)
  document.addEventListener('keyup', handleKeyboardShortcuts)

  // Initialize translation optimization
  initializeTranslationOptimization()

  // Start connection health monitoring
  setInterval(() => {
    updateConnectionHealth()
  }, 2000) // Check every 2 seconds

  // Enable connection optimization
  enableConnectionOptimization()
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.disconnect()
  }

  if (recognition.value) {
    recognition.value.stop()
  }

  if (synthesis.value) {
    synthesis.value.cancel()
  }

  // Clean up audio processing
  if (window.audioProcessingCleanup) {
    window.audioProcessingCleanup()
  }

  // Clear quality monitoring
  if (window.qualityMonitorInterval) {
    clearInterval(window.qualityMonitorInterval)
  }

  // Clean up WebRTC resources
  if (peerConnection.value) {
    peerConnection.value.close()
  }

  if (localStream.value) {
    localStream.value.getTracks().forEach(track => track.stop())
  }

  // Remove keyboard listeners
  document.removeEventListener('keydown', handleKeyboardShortcuts)
  document.removeEventListener('keyup', handleKeyboardShortcuts)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
    <!-- Hidden audio element for remote stream -->
    <audio id="remote-audio" autoplay playsinline style="display: none;"></audio>

    <!-- Animated Background Elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-float-delayed"></div>
      <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
    </div>

    <!-- Connection Status Bar -->
    <div class="relative z-10 bg-black/20 backdrop-blur-sm border-b border-white/10 px-4 py-2 transition-all duration-300">
      <div class="flex items-center justify-between max-w-6xl mx-auto">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <div :class="[
              'w-3 h-3 rounded-full transition-all duration-300 shadow-lg',
              isConnected ? 'bg-green-400 animate-pulse shadow-green-400/50' : 'bg-red-400 shadow-red-400/50'
            ]"></div>
            <span class="text-sm text-white/70 font-medium">
              {{ isConnected ? '🟢 Connected' : '🔴 Disconnected' }}
            </span>
          </div>

          <div v-if="room" class="flex items-center gap-4 ml-4 animate-slide-in">
            <div class="flex items-center gap-2">
              <span class="text-sm text-white/50">🏠 Room:</span>
              <button
                @click="copyRoomCode"
                class="text-sm font-mono bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-all duration-300 text-white hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
              >
                {{ room.id }}
              </button>
            </div>

            <!-- Enhanced Connection Status -->
            <div class="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg">
              <div :class="[
                'w-2 h-2 rounded-full transition-all duration-300',
                connectionHealth.status === 'excellent' ? 'bg-green-400 animate-pulse' :
                connectionHealth.status === 'good' ? 'bg-blue-400 animate-pulse' :
                connectionHealth.status === 'fair' ? 'bg-yellow-400 animate-pulse' :
                connectionHealth.status === 'poor' ? 'bg-red-400 animate-pulse' : 'bg-gray-400'
              ]"></div>
              <span class="text-xs text-white/70">
                {{ isAudioConnected ? '🔊 Audio Connected' : '🔄 Connecting Audio...' }}
              </span>
              <span v-if="connectionHealth.latency > 0" class="text-xs text-white/50">
                {{ connectionHealth.latency }}ms
              </span>
              <span v-if="connectionHealth.packetLoss > 0" class="text-xs text-red-300">
                {{ connectionHealth.packetLoss }}% loss
              </span>
            </div>

            <!-- Smart Status Indicator -->
            <div v-if="smartStatus.type !== 'idle'" class="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg animate-fade-in">
              <div :class="[
                'w-2 h-2 rounded-full',
                smartStatus.type === 'loading' ? 'bg-blue-400 animate-spin' :
                smartStatus.type === 'processing' ? 'bg-yellow-400 animate-pulse' :
                smartStatus.type === 'speaking' ? 'bg-green-400 animate-bounce' :
                smartStatus.type === 'success' ? 'bg-green-400' :
                smartStatus.type === 'error' ? 'bg-red-400' :
                smartStatus.type === 'warning' ? 'bg-yellow-400' : 'bg-gray-400'
              ]"></div>
              <span class="text-xs text-white/70">
                {{ smartStatus.message }}
              </span>
              <div v-if="smartStatus.progress > 0" class="w-8 h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-400 transition-all duration-300"
                  :style="{ width: smartStatus.progress + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="room" class="flex items-center gap-3 animate-slide-in">
          <div class="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg">
            <span class="text-sm text-white/50">👥</span>
            <span class="text-sm text-white font-medium">
              {{ room.users?.length || 0 }}/2
            </span>
          </div>
          <button
            @click="leaveRoom"
            class="text-sm text-red-400 hover:text-red-300 transition-all duration-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 active:scale-95"
          >
            🚪 Leave Room
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 p-4">
      <div class="max-w-6xl mx-auto">

        <!-- Join/Create Room Form -->
        <div v-if="showJoinForm" class="flex items-center justify-center min-h-[80vh] relative z-10">
          <div class="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 w-full max-w-md shadow-2xl animate-fade-in-up">
            <div class="text-center mb-8">
              <div class="text-6xl mb-4 animate-bounce-slow">🌍</div>
              <h1 class="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Real-Time Translation Chat
              </h1>
              <p class="text-white/60 text-lg">Connect with someone and chat in different languages</p>
              <div class="flex items-center justify-center gap-2 mt-4 text-white/40">
                <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <div class="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
              </div>
            </div>

            <div class="space-y-6">
              <!-- User Info -->
              <div class="animate-slide-in" style="animation-delay: 0.1s">
                <label class="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                  👤 Your Name
                </label>
                <input
                  v-model="userName"
                  type="text"
                  placeholder="Enter your name"
                  class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:bg-white/15 focus:scale-105"
                  @keyup.enter="roomCode ? joinRoom() : createRoom()"
                />
              </div>

              <!-- Language Selection -->
              <div class="animate-slide-in" style="animation-delay: 0.2s">
                <label class="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                  🗣️ Your Language
                </label>
                <select
                  v-model="userLanguage"
                  class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:bg-white/15 focus:scale-105"
                >
                  <option v-for="lang in languages" :key="lang.code" :value="lang.code" class="bg-slate-800">
                    {{ lang.name }}
                  </option>
                </select>
              </div>

              <!-- Room Code (for joining) -->
              <div class="animate-slide-in" style="animation-delay: 0.3s">
                <label class="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                  🔑 Room Code (optional)
                </label>
                <input
                  v-model="roomCode"
                  type="text"
                  placeholder="Enter room code to join"
                  class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase transition-all duration-300 hover:bg-white/15 focus:scale-105"
                  @keyup.enter="joinRoom()"
                />
              </div>

              <!-- Error Message -->
              <div v-if="connectionError" class="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm animate-shake flex items-center gap-2">
                ⚠️ {{ connectionError }}
              </div>

              <!-- Action Buttons -->
              <div class="space-y-3 animate-slide-in" style="animation-delay: 0.4s">
                <button
                  v-if="roomCode"
                  @click="joinRoom"
                  :disabled="isJoining || !isConnected"
                  class="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                >
                  <span v-if="isJoining" class="animate-spin">⏳</span>
                  <span v-else>🚪</span>
                  {{ isJoining ? 'Joining...' : 'Join Room' }}
                </button>

                <button
                  @click="createRoom"
                  :disabled="isJoining || !isConnected"
                  class="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                >
                  <span v-if="isJoining" class="animate-spin">⏳</span>
                  <span v-else>✨</span>
                  {{ isJoining ? 'Creating...' : 'Create New Room' }}
                </button>
              </div>

              <div class="text-center text-white/40 text-sm animate-fade-in" style="animation-delay: 0.5s">
                💡 Share the room code with someone to start chatting
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Interface -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[85vh]">

          <!-- Left Panel - User Info & Controls -->
          <div class="lg:col-span-1 space-y-4">

            <!-- Current User Card -->
            <div class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-xl animate-fade-in-up hover:bg-white/10 transition-all duration-300">
              <div class="text-center">
                <div class="relative inline-block">
                  <div class="text-4xl mb-3 animate-bounce-slow">{{ currentUser?.avatar || '👤' }}</div>
                  <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                </div>
                <h3 class="font-bold text-white text-lg">{{ currentUser?.name }}</h3>
                <p class="text-sm text-white/60 flex items-center justify-center gap-1 mt-1">
                  {{ getLanguageFlag(userLanguage) }} {{ getLanguageName(userLanguage) }}
                </p>

                <!-- User Status -->
                <div class="mt-4 p-4 bg-gradient-to-r from-white/5 to-white/10 rounded-xl border border-white/10">
                  <div class="flex items-center justify-center gap-2">
                    <div v-if="isListening" class="flex items-center gap-2 text-blue-400 animate-pulse">
                      <div class="relative">
                        <div class="w-3 h-3 bg-blue-400 rounded-full"></div>
                        <div class="absolute inset-0 w-3 h-3 bg-blue-400 rounded-full animate-ping"></div>
                      </div>
                      <span class="text-sm font-medium">🎤 Listening...</span>
                    </div>
                    <div v-else-if="isProcessing" class="flex items-center gap-2 text-yellow-400 animate-pulse">
                      <div class="relative">
                        <div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
                        <div class="absolute inset-0 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                      </div>
                      <span class="text-sm font-medium">⚡ Processing...</span>
                    </div>
                    <div v-else-if="isSpeaking" class="flex items-center gap-2 text-green-400 animate-pulse">
                      <div class="relative">
                        <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                        <div class="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                      </div>
                      <span class="text-sm font-medium">🔊 Speaking...</span>
                    </div>
                    <div v-else class="flex items-center gap-2 text-white/50">
                      <div class="w-3 h-3 bg-white/30 rounded-full"></div>
                      <span class="text-sm font-medium">✅ Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Other User Card -->
            <div class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-xl animate-fade-in-up hover:bg-white/10 transition-all duration-300" style="animation-delay: 0.1s">
              <div class="text-center">
                <div v-if="otherUser" class="space-y-3">
                  <div class="relative inline-block">
                    <div class="text-4xl animate-bounce-slow">{{ otherUser.avatar || '👤' }}</div>
                    <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                  </div>
                  <h3 class="font-bold text-white text-lg">{{ otherUser.name }}</h3>
                  <p class="text-sm text-white/60 flex items-center justify-center gap-1">
                    {{ getLanguageFlag(otherUser.language) }} {{ getLanguageName(otherUser.language) }}
                  </p>

                  <!-- Other User Status -->
                  <div class="p-4 bg-gradient-to-r from-white/5 to-white/10 rounded-xl border border-white/10">
                    <div class="flex items-center justify-center gap-2">
                      <div v-if="userStatus[otherUser.userId]?.type === 'listening'" class="flex items-center gap-2 text-blue-400 animate-pulse">
                        <div class="relative">
                          <div class="w-3 h-3 bg-blue-400 rounded-full"></div>
                          <div class="absolute inset-0 w-3 h-3 bg-blue-400 rounded-full animate-ping"></div>
                        </div>
                        <span class="text-sm font-medium">🎤 Listening...</span>
                      </div>
                      <div v-else-if="userStatus[otherUser.userId]?.type === 'processing'" class="flex items-center gap-2 text-yellow-400 animate-pulse">
                        <div class="relative">
                          <div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
                          <div class="absolute inset-0 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                        </div>
                        <span class="text-sm font-medium">⚡ Processing...</span>
                      </div>
                      <div v-else-if="userStatus[otherUser.userId]?.type === 'speaking'" class="flex items-center gap-2 text-green-400 animate-pulse">
                        <div class="relative">
                          <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                          <div class="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                        </div>
                        <span class="text-sm font-medium">🔊 Speaking...</span>
                      </div>
                      <div v-else class="flex items-center gap-2 text-white/50">
                        <div class="w-3 h-3 bg-white/30 rounded-full"></div>
                        <span class="text-sm font-medium">✅ Ready</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="text-white/40 animate-pulse">
                  <div class="text-5xl mb-4 animate-spin-slow">⏳</div>
                  <p class="text-lg font-medium">Waiting for someone to join...</p>
                  <div class="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
                    <p class="text-sm">Share room code:</p>
                    <span class="font-mono text-white bg-white/10 px-2 py-1 rounded mt-1 inline-block">{{ room?.id }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Voice Controls -->
            <div class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-xl animate-fade-in-up hover:bg-white/10 transition-all duration-300" style="animation-delay: 0.2s">
              <h4 class="font-bold text-white mb-6 text-center text-lg flex items-center justify-center gap-2">
                🎙️ Voice Controls
              </h4>

              <div class="flex justify-center mb-4">
                <button
                  @click="toggleVoiceRecording"
                  :disabled="!otherUser || isProcessing"
                  :class="[
                    'w-24 h-24 rounded-full border-4 transition-all duration-300 flex items-center justify-center text-3xl shadow-2xl relative overflow-hidden',
                    isListening
                      ? 'bg-gradient-to-r from-red-500 to-red-600 border-red-400 animate-pulse text-white shadow-red-500/50'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 border-blue-500 text-white shadow-blue-500/50 hover:scale-110',
                    (!otherUser || isProcessing) && 'opacity-50 cursor-not-allowed grayscale'
                  ]"
                >
                  <!-- Animated background for listening state -->
                  <div v-if="isListening" class="absolute inset-0 bg-gradient-to-r from-red-400 to-red-600 animate-pulse"></div>

                  <!-- Ripple effect -->
                  <div v-if="isListening" class="absolute inset-0 border-4 border-red-300 rounded-full animate-ping"></div>

                  <span class="relative z-10">
                    <span v-if="isListening" class="animate-bounce">🛑</span>
                    <span v-else>🎤</span>
                  </span>
                </button>
              </div>

              <div class="text-center space-y-2">
                <p class="text-sm text-white/80 font-medium">
                  {{ isListening ? '🔴 Recording... Click to stop' : '⚪ Click to start recording' }}
                </p>

                <!-- Audio visualization bars -->
                <!-- Audio visualization and interim results -->
                <div v-if="isListening" class="mt-3 space-y-2">
                  <!-- Audio visualization bars -->
                  <div class="flex items-center justify-center gap-1">
                    <div class="w-1 bg-blue-400 rounded-full animate-pulse" style="height: 12px; animation-delay: 0s"></div>
                    <div class="w-1 bg-blue-400 rounded-full animate-pulse" style="height: 20px; animation-delay: 0.1s"></div>
                    <div class="w-1 bg-blue-400 rounded-full animate-pulse" style="height: 16px; animation-delay: 0.2s"></div>
                    <div class="w-1 bg-blue-400 rounded-full animate-pulse" style="height: 24px; animation-delay: 0.3s"></div>
                    <div class="w-1 bg-blue-400 rounded-full animate-pulse" style="height: 18px; animation-delay: 0.4s"></div>
                    <div class="w-1 bg-blue-400 rounded-full animate-pulse" style="height: 14px; animation-delay: 0.5s"></div>
                    <div class="w-1 bg-blue-400 rounded-full animate-pulse" style="height: 22px; animation-delay: 0.6s"></div>
                  </div>

                  <!-- Interim speech results -->
                  <div v-if="currentMessage" class="bg-blue-500/20 border border-blue-500/30 rounded-lg p-2 text-xs text-blue-300">
                    <div class="flex items-center gap-1 mb-1">
                      <span>🎤</span>
                      <span class="opacity-70">Listening:</span>
                    </div>
                    <div class="italic">{{ currentMessage }}</div>
                  </div>
                </div>

                <div v-if="!otherUser" class="text-xs text-yellow-400 bg-yellow-400/10 px-3 py-2 rounded-lg border border-yellow-400/20">
                  ⚠️ Waiting for another user to join
                </div>

                <!-- Audio Controls -->
                <div v-if="otherUser" class="mt-4 space-y-3">
                  <div class="flex items-center justify-center gap-3">
                    <!-- Audio Toggle -->
                    <button
                      @click="toggleAudio"
                      :class="[
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2',
                        isAudioEnabled
                          ? 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30'
                          : 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30'
                      ]"
                    >
                      <span>{{ isAudioEnabled ? '🔊' : '🔇' }}</span>
                      {{ isAudioEnabled ? 'Mute' : 'Unmute' }}
                    </button>

                    <!-- Audio Quality -->
                    <select
                      v-model="audioQuality"
                      @change="setAudioQuality(audioQuality)"
                      class="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="high" class="bg-slate-800">🔊 High Quality</option>
                      <option value="standard" class="bg-slate-800">📻 Standard</option>
                    </select>
                  </div>

                  <!-- Connection Quality Indicator -->
                  <div class="flex items-center justify-center gap-2 text-xs">
                    <span class="text-white/50">Connection:</span>
                    <span :class="[
                      'font-medium',
                      connectionQuality === 'excellent' ? 'text-green-400' :
                      connectionQuality === 'good' ? 'text-blue-400' :
                      connectionQuality === 'fair' ? 'text-yellow-400' : 'text-red-400'
                    ]">
                      {{ connectionQuality.toUpperCase() }}
                    </span>
                    <span v-if="latency > 0" class="text-white/40">
                      ({{ latency }}ms)
                    </span>
                  </div>
                </div>

                <!-- Advanced Audio Controls -->
                <div v-if="otherUser" class="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <h5 class="text-sm font-medium text-white/70 text-center">🎛️ Audio Controls</h5>

                  <!-- Volume Controls -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <label class="text-xs text-white/60">🎤 Input Volume</label>
                      <span class="text-xs text-white/40">{{ inputVolume }}%</span>
                    </div>
                    <input
                      v-model="inputVolume"
                      @input="setInputVolume(inputVolume)"
                      type="range"
                      min="0"
                      max="100"
                      class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <label class="text-xs text-white/60">🔊 Output Volume</label>
                      <span class="text-xs text-white/40">{{ outputVolume }}%</span>
                    </div>
                    <input
                      v-model="outputVolume"
                      @input="setOutputVolume(outputVolume)"
                      type="range"
                      min="0"
                      max="100"
                      class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <!-- Audio Processing Toggles -->
                  <div class="flex items-center justify-center gap-2">
                    <button
                      @click="toggleNoiseReduction"
                      :class="[
                        'px-3 py-1 rounded-lg text-xs font-medium transition-all duration-300',
                        noiseReduction
                          ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                          : 'bg-white/10 text-white/60 border border-white/20'
                      ]"
                    >
                      🔇 Noise Reduction
                    </button>

                    <button
                      @click="toggleEchoCancellation"
                      :class="[
                        'px-3 py-1 rounded-lg text-xs font-medium transition-all duration-300',
                        echoCancellation
                          ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                          : 'bg-white/10 text-white/60 border border-white/20'
                      ]"
                    >
                      📢 Echo Cancel
                    </button>
                  </div>

                  <!-- Audio Presets -->
                  <div class="space-y-2">
                    <label class="text-xs text-white/60 block text-center">🎚️ Presets</label>
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        @click="setAudioPreset('voice')"
                        class="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 text-xs rounded-lg transition-all duration-300"
                      >
                        🗣️ Voice
                      </button>
                      <button
                        @click="setAudioPreset('music')"
                        class="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 text-xs rounded-lg transition-all duration-300"
                      >
                        🎵 Music
                      </button>
                      <button
                        @click="setAudioPreset('low-bandwidth')"
                        class="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 text-xs rounded-lg transition-all duration-300"
                      >
                        📶 Low Data
                      </button>
                      <button
                        @click="autoAdjustAudio"
                        class="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded-lg transition-all duration-300 border border-blue-500/30"
                      >
                        🤖 Auto
                      </button>
                    </div>
                  </div>

                  <!-- Cache Management -->
                  <div class="mt-4 pt-3 border-t border-white/10">
                    <div class="flex items-center justify-between mb-2">
                      <label class="text-xs text-white/60">📋 Translation Cache</label>
                      <span class="text-xs text-white/40">{{ translationCache.size }} entries</span>
                    </div>
                    <div class="flex gap-2">
                      <button
                        @click="persistentCache.save()"
                        class="flex-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded-lg transition-all duration-300 border border-blue-500/30"
                      >
                        💾 Save
                      </button>
                      <button
                        @click="persistentCache.clear()"
                        class="flex-1 px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded-lg transition-all duration-300 border border-red-500/30"
                      >
                        🗑️ Clear
                      </button>
                    </div>
                  </div>

                  <!-- Connection Optimization Controls -->
                  <div class="mt-4 pt-3 border-t border-white/10">
                    <h5 class="text-sm font-medium text-white/70 text-center mb-3">🔧 Connection Optimization</h5>

                    <div class="space-y-3">
                      <!-- Network Status -->
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-white/60">Network:</span>
                        <div class="flex items-center gap-2">
                          <span :class="[
                            'px-2 py-1 rounded-full',
                            connectionOptimization.networkType === '4g' || connectionOptimization.networkType === '5g' ? 'bg-green-500/20 text-green-400' :
                            connectionOptimization.networkType === '3g' ? 'bg-yellow-500/20 text-yellow-400' :
                            connectionOptimization.networkType === '2g' || connectionOptimization.networkType === 'slow-2g' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          ]">
                            {{ connectionOptimization.networkType.toUpperCase() }}
                          </span>
                          <span :class="[
                            'px-2 py-1 rounded-full text-xs',
                            connectionOptimization.connectionStability === 'stable' ? 'bg-green-500/20 text-green-400' :
                            connectionOptimization.connectionStability === 'unstable' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          ]">
                            {{ connectionOptimization.connectionStability }}
                          </span>
                        </div>
                      </div>

                      <!-- Optimization Toggles -->
                      <div class="flex items-center justify-between">
                        <span class="text-xs text-white/60">Adaptive Quality:</span>
                        <button
                          @click="connectionOptimization.adaptiveQuality = !connectionOptimization.adaptiveQuality"
                          :class="[
                            'w-8 h-4 rounded-full transition-all duration-300 relative',
                            connectionOptimization.adaptiveQuality ? 'bg-green-500' : 'bg-gray-600'
                          ]"
                        >
                          <div :class="[
                            'w-3 h-3 bg-white rounded-full transition-all duration-300 absolute top-0.5',
                            connectionOptimization.adaptiveQuality ? 'left-4' : 'left-0.5'
                          ]"></div>
                        </button>
                      </div>

                      <div class="flex items-center justify-between">
                        <span class="text-xs text-white/60">Bandwidth Monitor:</span>
                        <button
                          @click="connectionOptimization.bandwidthMonitoring = !connectionOptimization.bandwidthMonitoring"
                          :class="[
                            'w-8 h-4 rounded-full transition-all duration-300 relative',
                            connectionOptimization.bandwidthMonitoring ? 'bg-green-500' : 'bg-gray-600'
                          ]"
                        >
                          <div :class="[
                            'w-3 h-3 bg-white rounded-full transition-all duration-300 absolute top-0.5',
                            connectionOptimization.bandwidthMonitoring ? 'left-4' : 'left-0.5'
                          ]"></div>
                        </button>
                      </div>

                      <!-- Reconnection Status -->
                      <div v-if="connectionOptimization.isReconnecting" class="text-xs text-center p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                        <div class="flex items-center justify-center gap-2 text-yellow-300">
                          <div class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                          <span>Reconnecting... ({{ connectionOptimization.reconnectAttempts }}/{{ connectionOptimization.maxReconnectAttempts }})</span>
                        </div>
                      </div>

                      <!-- Manual Reconnect Button -->
                      <button
                        v-if="!isConnected && !connectionOptimization.isReconnecting"
                        @click="attemptReconnection"
                        class="w-full px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded-lg transition-all duration-300 border border-blue-500/30"
                      >
                        🔄 Reconnect Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Panel - Chat Messages -->
          <div class="lg:col-span-2 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col shadow-xl animate-fade-in-up" style="animation-delay: 0.3s">

            <!-- Enhanced Chat Header -->
            <div class="border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10">
              <div class="p-6">
                <div class="flex items-center justify-between">
                  <h3 class="font-bold text-white text-xl flex items-center gap-2">
                    💬 Conversation
                    <span v-if="messages.length > 0" class="text-sm text-white/50 font-normal">
                      ({{ messages.length }} messages)
                    </span>
                  </h3>

                  <div class="flex items-center gap-3">
                    <!-- Search Toggle -->
                    <button
                      @click="toggleSearchPanel"
                      :class="[
                        'p-2 rounded-lg transition-all duration-300 flex items-center gap-2',
                        chatInterface.showSearch
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      ]"
                    >
                      <span class="text-sm">🔍</span>
                      <span v-if="chatInterface.searchResults.length > 0" class="text-xs">
                        {{ chatInterface.searchResults.length }}
                      </span>
                    </button>

                    <!-- Export Conversation -->
                    <button
                      v-if="messages.length > 0"
                      @click="exportConversation"
                      class="p-2 rounded-lg transition-all duration-300 flex items-center gap-2 bg-white/10 text-white/70 hover:bg-white/20"
                      title="Export conversation"
                    >
                      <span class="text-sm">📄</span>
                    </button>

                    <!-- Conversation Stats -->
                    <div v-if="messages.length > 0" class="text-xs text-white/50 bg-white/5 px-3 py-2 rounded-lg">
                      <div class="flex items-center gap-3">
                        <span>{{ getConversationStats().totalMessages }} msgs</span>
                        <span>{{ Math.round(getConversationStats().averageConfidence * 100) }}% avg</span>
                        <span>{{ formatDuration(getConversationStats().conversationDuration) }}</span>
                      </div>
                    </div>

                    <!-- Language Indicator -->
                    <div class="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                      <div class="flex items-center gap-2">
                        <span class="text-lg">{{ getLanguageFlag(userLanguage) }}</span>
                        <span class="text-xs text-white/60">{{ userLanguage.split('-')[0].toUpperCase() }}</span>
                      </div>
                      <div class="text-white/40 animate-pulse">↔️</div>
                      <div class="flex items-center gap-2">
                        <span class="text-lg">{{ otherUser ? getLanguageFlag(otherUser.language) : '🌍' }}</span>
                        <span class="text-xs text-white/60">{{ otherUser ? otherUser.language.split('-')[0].toUpperCase() : 'ANY' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Search Panel -->
              <div v-if="chatInterface.showSearch" class="px-6 pb-4 animate-fade-in">
                <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div class="flex items-center gap-3 mb-3">
                    <div class="flex-1 relative">
                      <input
                        v-model="chatInterface.searchQuery"
                        @input="searchMessages(chatInterface.searchQuery)"
                        type="text"
                        placeholder="Search messages..."
                        class="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div class="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/30">
                        🔍
                      </div>
                    </div>
                    <button
                      @click="clearSearch"
                      class="px-3 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-all duration-300"
                    >
                      Clear
                    </button>
                  </div>

                  <!-- Filter and Sort Controls -->
                  <div class="flex items-center gap-3 text-sm">
                    <div class="flex items-center gap-2">
                      <span class="text-white/60">Filter:</span>
                      <select
                        v-model="chatInterface.filterBy"
                        class="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="all" class="bg-slate-800">All Messages</option>
                        <option value="original" class="bg-slate-800">Original Only</option>
                        <option value="translation" class="bg-slate-800">Translations Only</option>
                        <option value="errors" class="bg-slate-800">Errors/Low Confidence</option>
                      </select>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="text-white/60">Sort:</span>
                      <select
                        v-model="chatInterface.sortBy"
                        class="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="newest" class="bg-slate-800">Newest First</option>
                        <option value="oldest" class="bg-slate-800">Oldest First</option>
                        <option value="relevance" class="bg-slate-800">Relevance</option>
                      </select>
                    </div>

                    <div v-if="chatInterface.searchQuery" class="text-white/50 text-xs">
                      {{ chatInterface.searchResults.length }} results
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Messages Container -->
            <div
              id="messages-container"
              class="flex-1 p-4 overflow-y-auto space-y-4 min-h-0"
            >
              <div v-if="messages.length === 0" class="flex items-center justify-center h-full text-white/40">
                <div class="text-center">
                  <div class="text-4xl mb-4">💬</div>
                  <p>Start a conversation by speaking or typing</p>
                  <p class="text-sm mt-2">Your messages will be translated automatically</p>
                </div>
              </div>

              <!-- Enhanced Message Bubbles -->
              <div v-for="message in getFilteredAndSortedMessages()" :key="message.id"
                   :id="`message-${message.id}`"
                   :class="[
                     'space-y-2 transition-all duration-300',
                     chatInterface.selectedMessage?.id === message.id ? 'ring-2 ring-blue-500 rounded-lg p-2' : ''
                   ]"
                   @click="selectMessage(message)">

                <!-- Original Message -->
                <div v-if="message.type === 'original'"
                     :class="[
                       'flex',
                       message.userId === currentUser?.userId ? 'justify-end' : 'justify-start'
                     ]">
                  <div :class="[
                    'max-w-xs lg:max-w-md px-4 py-3 rounded-2xl',
                    message.userId === currentUser?.userId
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-white'
                  ]">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-xs opacity-70">
                        {{ message.userId === currentUser?.userId ? 'You' : otherUser?.name || 'Other' }}
                      </span>
                      <span class="text-xs opacity-50">
                        {{ getLanguageFlag(message.language) }}
                      </span>
                      <span v-if="message.confidence" class="text-xs opacity-50">
                        {{ Math.round(message.confidence * 100) }}%
                      </span>
                    </div>
                    <p class="text-sm" v-html="highlightSearchText(message.text, chatInterface.searchQuery)"></p>
                    <div class="flex items-center justify-between mt-2">
                      <div class="text-xs opacity-50">
                        {{ formatTime(message.timestamp) }}
                      </div>
                      <div class="flex items-center gap-2">
                        <span v-if="message.confidence" class="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                          {{ Math.round(message.confidence * 100) }}%
                        </span>
                        <span v-if="message.detectedLanguage && message.detectedLanguage !== message.language"
                              class="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300">
                          🌍 Auto
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Translation Message -->
                <div v-if="message.type === 'translation'"
                     :class="[
                       'flex',
                       message.targetUserId === currentUser?.userId ? 'justify-start' : 'justify-end'
                     ]">
                  <div :class="[
                    'max-w-xs lg:max-w-md px-4 py-3 rounded-2xl border-2',
                    message.targetUserId === currentUser?.userId
                      ? 'bg-green-600/20 border-green-500/30 text-green-100'
                      : 'bg-purple-600/20 border-purple-500/30 text-purple-100'
                  ]">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-xs opacity-70">🌍 Translation</span>
                      <span class="text-xs opacity-50">
                        {{ getLanguageFlag(message.targetLanguage) }}
                      </span>
                    </div>
                    <p class="text-sm" v-html="highlightSearchText(message.translatedText, chatInterface.searchQuery)"></p>
                    <div class="flex items-center justify-between mt-2">
                      <div class="text-xs opacity-50">
                        {{ formatTime(message.timestamp) }}
                      </div>
                      <div class="flex items-center gap-2">
                        <span v-if="message.contextualConfidence" class="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">
                          {{ Math.round(message.contextualConfidence * 100) }}% context
                        </span>
                        <span v-if="message.translationAttempts > 1" class="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-300">
                          {{ message.translationAttempts }} attempts
                        </span>
                      </div>
                    </div>

                    <!-- Context Hints -->
                    <div v-if="message.contextHints && message.contextHints.length > 0" class="mt-2 space-y-1">
                      <div v-for="hint in message.contextHints" :key="hint.type"
                           class="text-xs p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-200">
                        <span class="mr-1">{{ hint.icon }}</span>
                        {{ hint.message }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Typing Indicator -->
              <div v-if="typingIndicator.isTyping" class="animate-fade-in px-4 pb-2">
                <div class="flex items-center gap-2 text-white/60">
                  <div class="text-sm">{{ typingIndicator.user }} is typing</div>
                  <div class="flex items-center gap-1">
                    <div class="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                    <div class="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                    <div class="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Message Input -->
            <div class="p-6 border-t border-white/10 bg-gradient-to-r from-white/5 to-white/10">
              <div class="flex gap-3">
                <div class="flex-1 relative">
                  <input
                    v-model="messageInput"
                    type="text"
                    placeholder="Type a message..."
                    :disabled="!otherUser || isProcessing"
                    class="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-all duration-300 hover:bg-white/15 focus:scale-105 pr-12"
                    @keyup.enter="sendTextMessage"
                    @input="handleTypingActivity"
                    @focus="startTyping"
                    @blur="stopTyping"
                  />
                  <div class="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/30">
                    ✏️
                  </div>
                </div>
                <button
                  @click="sendTextMessage"
                  :disabled="!messageInput.trim() || !otherUser || isProcessing"
                  class="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                >
                  <span v-if="isProcessing" class="animate-spin">⏳</span>
                  <span v-else>📤</span>
                  Send
                </button>
              </div>

              <div class="flex items-center justify-center mt-4 text-sm text-white/40 space-x-4">
                <div class="flex items-center gap-1">
                  <span>⌨️</span>
                  <span>Enter to send</span>
                </div>
                <div class="w-1 h-1 bg-white/20 rounded-full"></div>
                <div class="flex items-center gap-1">
                  <span>🎤</span>
                  <span>Click or Space for voice</span>
                </div>
                <div class="w-1 h-1 bg-white/20 rounded-full"></div>
                <div class="flex items-center gap-1">
                  <span>⎋</span>
                  <span>Esc to stop</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for messages */
#messages-container::-webkit-scrollbar {
  width: 6px;
}

#messages-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

#messages-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

#messages-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Enhanced animations */
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-pulse-slow {
  animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-bounce-slow {
  animation: bounce-slow 3s ease-in-out infinite;
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-float-delayed {
  animation: float 6s ease-in-out infinite;
  animation-delay: 3s;
}

.animate-spin-slow {
  animation: spin 3s linear infinite;
}

.animate-fade-in {
  animation: fade-in 0.8s ease-out forwards;
}

.animate-fade-in-up {
  animation: fade-in-up 0.8s ease-out forwards;
}

.animate-slide-in {
  animation: slide-in 0.6s ease-out forwards;
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}

/* Keyframe definitions */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}

@keyframes pulse-slow {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 0.3;
  }
}

@keyframes bounce-slow {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  33% {
    transform: translateY(-20px) rotate(1deg);
  }
  66% {
    transform: translateY(-10px) rotate(-1deg);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

/* Message animations */
.space-y-4 > * + * {
  margin-top: 1rem;
}

/* Hover effects */
.hover\\:scale-105:hover {
  transform: scale(1.05);
}

.hover\\:scale-110:hover {
  transform: scale(1.1);
}

.active\\:scale-95:active {
  transform: scale(0.95);
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .grid-cols-1.lg\\:grid-cols-3 {
    grid-template-columns: 1fr;
  }

  .lg\\:col-span-1,
  .lg\\:col-span-2 {
    grid-column: span 1;
  }
}

/* Glass morphism effects */
.backdrop-blur-xl {
  backdrop-filter: blur(16px);
}

/* Custom gradient text */
.bg-gradient-to-r.from-blue-400.to-purple-400.bg-clip-text.text-transparent {
  background: linear-gradient(to right, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Custom slider styles */
.slider::-webkit-slider-thumb {
  appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.4);
}

.slider::-webkit-slider-track {
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2));
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.slider::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.slider::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2));
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
