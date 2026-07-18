import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ChatMessage, FileMeta, IncomingFile, ReceivedFile, SignalPayload } from '../types'

function getParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    code: params.get('code'),
    username: params.get('username') || 'Anonymous',
    isAdmin: params.get('admin') === '1',
  }
}

function getExpiry(createdAt: string, timeLimit: string): Date {
  const d = new Date(createdAt)
  if (timeLimit === '5m') d.setMinutes(d.getMinutes() + 5)
  else if (timeLimit === '30m') d.setMinutes(d.getMinutes() + 30)
  else if (timeLimit === '1h') d.setHours(d.getHours() + 1)
  else if (timeLimit === '2h') d.setHours(d.getHours() + 2)
  else if (timeLimit === '5h') d.setHours(d.getHours() + 5)
  return d
}

export default function Room() {
  const [users, setUsers] = useState<{ userId: string; username: string }[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9))
  const [username, setUsername] = useState('Anonymous')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [timeLimit, setTimeLimit] = useState('')
  const [createdAt, setCreatedAt] = useState('')
  const [timeLeft, setTimeLeft] = useState('')
  const [files, setFiles] = useState<ReceivedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [kicked, setKicked] = useState(false)
  const [ended, setEnded] = useState(false)
  const [incomingFiles, setIncomingFiles] = useState<Record<string, IncomingFile>>({})
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'chat' | 'video' | 'sidebar'>('video')

  const peerConnections = useRef<Record<string, RTCPeerConnection>>({})
  const dataChannels = useRef<Record<string, RTCDataChannel>>({})
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  const userIdRef = useRef(userId)
  userIdRef.current = userId

  const incomingFilesRef = useRef(incomingFiles)
  incomingFilesRef.current = incomingFiles

  const dataChannelsRef = useRef(dataChannels.current)
  dataChannelsRef.current = dataChannels.current

  const sendSignalRef = useRef<(to: string, data: Partial<SignalPayload>) => void>(() => {})
  const createPeerConnectionRef = useRef<(peerId: string) => RTCPeerConnection>(() => null as any)

  const sendSignal = useCallback(
    (to: string, data: Partial<SignalPayload>) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: { ...data, from: userIdRef.current, to },
      })
    },
    [],
  )
  sendSignalRef.current = sendSignal

  const addMediaTracksToPC = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current
    if (!stream) return
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream)
    }
  }, [])

  const setupDataChannel = useCallback((peerId: string, dc: RTCDataChannel) => {
    dc.onopen = () => {
      dataChannels.current[peerId] = dc
      dataChannelsRef.current = dataChannels.current
    }
    dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type === 'chat') {
          setMessages((prev) => [...prev, parsed])
        } else if (parsed.type === 'file-meta') {
          const meta = parsed as FileMeta
          setIncomingFiles((prev) => ({
            ...prev,
            [meta.fileId]: { meta, chunks: [], receivedSize: 0 },
          }))
        }
      } catch {
        const buf: ArrayBuffer = event.data
        const currentIncoming = incomingFilesRef.current
        const targetId = Object.entries(currentIncoming).find(
          ([, f]) => f.receivedSize < f.meta.size,
        )?.[0]
        if (targetId) {
          setIncomingFiles((prev) => {
            const f = prev[targetId]
            if (!f) return prev
            const newChunks = [...f.chunks, buf]
            const newSize = f.receivedSize + buf.byteLength
            if (newSize >= f.meta.size) {
              const blob = new Blob(newChunks, { type: f.meta.fileType })
              setFiles((prevFiles) => [
                ...prevFiles,
                { name: f.meta.fileName, type: f.meta.fileType, data: blob, fileId: f.meta.fileId },
              ])
              const rest = { ...prev }
              delete rest[targetId]
              return rest
            }
            return { ...prev, [targetId]: { ...f, chunks: newChunks, receivedSize: newSize } }
          })
        }
      }
    }
    dc.onclose = () => {
      delete dataChannels.current[peerId]
      dataChannelsRef.current = dataChannels.current
    }
  }, [])

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      if (peerConnections.current[peerId]) return peerConnections.current[peerId]
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: 'turn:openrelayproject.org:3478',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      })

      if (userIdRef.current < peerId) {
        const dc = pc.createDataChannel('chat')
        setupDataChannel(peerId, dc)
      } else {
        pc.ondatachannel = (event) => setupDataChannel(peerId, event.channel)
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalRef.current(peerId, { type: 'candidate', candidate: event.candidate.toJSON() })
        }
      }

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0])
      }

      addMediaTracksToPC(pc)

      peerConnections.current[peerId] = pc
      return pc
    },
    [setupDataChannel, addMediaTracksToPC],
  )
  createPeerConnectionRef.current = createPeerConnection

  const handleSignal = useCallback(
    async (data: SignalPayload) => {
      const { from, to, type, sdp, candidate } = data
      if (to && to !== userIdRef.current) return

      let pc = peerConnections.current[from]
      if (type === 'offer') {
        if (!pc) pc = createPeerConnectionRef.current(from)
        if (pc.signalingState === 'have-local-offer') {
          if (userIdRef.current > from) {
            await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit)
            await pc.setRemoteDescription(new RTCSessionDescription(sdp!))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            sendSignalRef.current(from, { type: 'answer', sdp: answer })
          }
        } else if (pc.signalingState === 'stable' || pc.signalingState === 'have-remote-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp!))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendSignalRef.current(from, { type: 'answer', sdp: answer })
        }
      } else if (type === 'answer') {
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp!))
        }
      } else if (type === 'candidate') {
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          } catch {
            // ignore duplicate candidates
          }
        }
      }
    },
    [],
  )
  const handleSignalRef = useRef(handleSignal)
  handleSignalRef.current = handleSignal

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  const toggleVideo = useCallback(() => {
    if (!localStream) return
    localStream.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled
    })
    setVideoEnabled((prev) => !prev)
  }, [localStream])

  const toggleAudio = useCallback(() => {
    if (!localStream) return
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled
    })
    setAudioEnabled((prev) => !prev)
  }, [localStream])

  const handleScreenShare = useCallback(async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const videoTrack = displayStream.getVideoTracks()[0]
      if (!videoTrack) return
      videoTrack.onended = () => {
        // Restore camera when screen share ends
        if (localStreamRef.current) {
          const camTrack = localStreamRef.current.getVideoTracks()[0]
          if (camTrack) {
            Object.values(peerConnections.current).forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
              if (sender) sender.replaceTrack(camTrack)
            })
          }
        }
      }
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(videoTrack)
      })
      setLocalStream(displayStream)
      localStreamRef.current = displayStream
    } catch {
      // user cancelled
    }
  }, [])

  useEffect(() => {
    const { code, username: uname, isAdmin: admin } = getParams()
    if (!code) {
      setEnded(true)
      return
    }
    setUsername(uname)
    setRoomCode(code)
    setIsAdmin(admin)

    ;(async () => {
      // Try to get camera/mic early
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        localStreamRef.current = stream
        setLocalStream(stream)
      } catch (err: unknown) {
        const msg = err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera/mic permission denied. Text-only mode.'
          : 'Failed to access camera/mic. Text-only mode.'
        setMediaError(msg)
      }

      const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single<{ admin_username: string; time_limit: string; created_at: string }>()

      if (!room) {
        alert('Room not found or has ended.')
        setEnded(true)
        return
      }

      setAdminUsername(room.admin_username)
      setTimeLimit(room.time_limit)
      setCreatedAt(room.created_at)

      const channel = supabase.channel(`room:${code}`, {
        config: { presence: { key: userIdRef.current } },
      })

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setUsers(
          Object.entries(state).map(([id, arr]) => ({
            userId: id,
            username: (arr[0] as any)?.username || 'Unknown',
          })),
        )
      })

      channel.on('presence', { event: 'join' }, ({ key }) => {
        const uid = userIdRef.current
        if (key !== uid && !peerConnections.current[key]) {
          if (uid < key) {
            const pc = createPeerConnectionRef.current(key)
            ;(async () => {
              try {
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                sendSignalRef.current(key, { type: 'offer', sdp: offer })
              } catch (err) {
                console.error('Error creating offer for', key, err)
              }
            })()
          }
        }
      })

      channel.on('broadcast', { event: 'admin' }, ({ payload }) => {
        if (payload.type === 'kick' && payload.userId === userIdRef.current) {
          setKicked(true)
          setTimeout(() => window.close(), 1500)
        }
        if (payload.type === 'end') {
          setEnded(true)
          setTimeout(() => window.close(), 1500)
        }
      })

      channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleSignalRef.current(payload as SignalPayload)
      })

      await channel.subscribe()
      channel.track({ username: uname })
      channelRef.current = channel

      const expiry = getExpiry(room.created_at, room.time_limit)
      timerRef.current = setInterval(() => {
        const now = new Date()
        const diff = Math.max(0, expiry.getTime() - now.getTime())
        if (diff <= 0) {
          setTimeLeft('00:00')
          setEnded(true)
          clearInterval(timerRef.current!)
          setTimeout(() => window.close(), 2000)
          return
        }
        const min = String(Math.floor(diff / 60000)).padStart(2, '0')
        const sec = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')
        setTimeLeft(`${min}:${sec}`)
      }, 1000)
    })()

    return () => {
      channelRef.current?.unsubscribe()
      Object.values(peerConnections.current).forEach((pc) => pc.close())
      peerConnections.current = {}
      if (timerRef.current) clearInterval(timerRef.current)
      // stop camera/mic
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(() => {
    if (!chatInput.trim()) return
    const msg: ChatMessage = { type: 'chat', user: userIdRef.current, username, text: chatInput }
    let sent = false
    Object.values(dataChannels.current).forEach((dc) => {
      if (dc.readyState === 'open') {
        dc.send(JSON.stringify(msg))
        sent = true
      }
    })
    setMessages((prev) => [...prev, msg])
    setChatInput('')
    if (!sent) console.warn('No open data channels to send message')
  }, [chatInput, username])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setUploading(true)
      const reader = new FileReader()
      reader.onload = () => {
        const buf = reader.result as ArrayBuffer
        const fileId = `${userIdRef.current}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
        const meta: FileMeta = {
          type: 'file-meta',
          fileName: file.name,
          fileType: file.type,
          size: file.size,
          fileId,
          fromUser: userIdRef.current,
          fromUsername: username,
        }
        Object.values(dataChannels.current).forEach((dc) => {
          if (dc.readyState === 'open') {
            dc.send(JSON.stringify(meta))
            const chunkSize = 16 * 1024
            for (let i = 0; i < buf.byteLength; i += chunkSize) {
              dc.send(buf.slice(i, i + chunkSize))
            }
          }
        })
        const blob = new Blob([buf], { type: file.type })
        setFiles((prev) => [...prev, { name: file.name, type: file.type, data: blob, fileId }])
        setSelectedFile((prev) => (prev !== null ? prev : 0))
        setUploading(false)
      }
      reader.readAsArrayBuffer(file)
    },
    [username],
  )

  const handleEndMeeting = useCallback(async () => {
    if (isAdmin) {
      await supabase.from('rooms').delete().eq('code', roomCode)
      channelRef.current?.send({ type: 'broadcast', event: 'admin', payload: { type: 'end' } })
    } else {
      channelRef.current?.unsubscribe()
      Object.values(peerConnections.current).forEach((pc) => pc.close())
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    setEnded(true)
    setTimeout(() => window.close(), 1500)
  }, [isAdmin, roomCode])

  const handleKick = useCallback(
    (targetUserId: string) => {
      if (!isAdmin || targetUserId === userId) return
      channelRef.current?.send({
        type: 'broadcast',
        event: 'admin',
        payload: { type: 'kick', userId: targetUserId },
      })
    },
    [isAdmin, userId],
  )

  if (kicked)
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="card text-center">
          <p className="text-xl text-red-500 dark:text-red-400">You were kicked from the room.</p>
        </div>
      </div>
    )

  if (ended)
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="card text-center">
          <p className="text-xl text-gray-400 dark:text-white/60">Meeting ended.</p>
        </div>
      </div>
    )

  const currentFile = selectedFile !== null ? files[selectedFile] : null
  const hasPeer = users.length > 1

  return (
    <div className="min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-2 p-2 overflow-y-auto lg:overflow-hidden pb-14 lg:pb-2">
      {/* Chat panel */}
      <div className={`card flex flex-col flex-1 lg:max-w-xs min-w-0 p-0 overflow-hidden ${mobileTab !== 'chat' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-3 border-b border-gray-200 dark:border-white/5 font-semibold text-sm shrink-0">
          Chat
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-black/20">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.user === userId ? 'justify-end' : ''}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  msg.user === userId
                    ? 'bg-accent-purple/20 text-white rounded-br-md'
                    : 'glass rounded-bl-md'
                }`}
              >
                <div className="text-xs font-semibold text-accent-cyan mb-0.5">
                  {msg.user === userId ? 'You' : msg.username}
                </div>
                <div>{msg.text}</div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-2 p-3 border-t border-gray-200 dark:border-white/5 shrink-0">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="input-field text-sm flex-1"
          />
          <button onClick={sendMessage} className="btn-primary text-sm px-4 py-1.5">
            Send
          </button>
        </div>
      </div>

      {/* Center: Video + Files */}
      <div className={`card flex flex-col flex-[2] min-w-0 p-0 overflow-y-auto ${mobileTab !== 'video' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-white/5 text-sm shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-accent-cyan text-xs">Code: {roomCode}</span>
            <span className="text-gray-300 dark:text-white/40">|</span>
            <span className={timeLeft ? 'text-accent-emerald' : 'text-red-500 dark:text-red-400'}>
              {timeLeft || '00:00'}
            </span>
            <span className="text-gray-300 dark:text-white/40">|</span>
            <span className="text-gray-400 dark:text-white/50">Host: {adminUsername}</span>
          </div>
          <button onClick={handleEndMeeting} className="btn-secondary text-xs px-3 py-1 shrink-0">
            {isAdmin ? 'End Meeting' : 'Leave'}
          </button>
        </div>

        {/* Video section */}
        <div className="relative bg-black/40 min-h-[200px] max-h-[50vh] flex items-center justify-center shrink-0">
          {mediaError && (
            <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm p-4 text-center z-10">
              {mediaError}
            </div>
          )}
          <div className="flex w-full h-full">
            <div className="flex-1 relative flex items-center justify-center min-h-[200px]">
              {remoteStream && hasPeer ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-white/30 text-sm text-center p-4">
                  {hasPeer ? 'Remote video incoming...' : 'Waiting for someone to join...'}
                </div>
              )}
            </div>
          </div>
          {localStream && (
            <div className="absolute bottom-2 right-2 w-1/4 max-w-[160px] aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-lg z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Video controls */}
        <div className="sticky bottom-0 z-10 flex items-center justify-center gap-3 p-2 border-t border-gray-200 dark:border-white/5 bg-white dark:bg-dark shrink-0">
          <button
            onClick={toggleAudio}
            disabled={!localStream}
            className={`p-2 rounded-full text-xs transition-colors ${
              audioEnabled ? 'glass text-white' : 'bg-red-500/30 text-red-300'
            } disabled:opacity-30`}
            title={audioEnabled ? 'Mute mic' : 'Unmute mic'}
          >
            {audioEnabled ? '🎤' : '🔇'}
          </button>
          <button
            onClick={toggleVideo}
            disabled={!localStream}
            className={`p-2 rounded-full text-xs transition-colors ${
              videoEnabled ? 'glass text-white' : 'bg-red-500/30 text-red-300'
            } disabled:opacity-30`}
            title={videoEnabled ? 'Stop camera' : 'Start camera'}
          >
            {videoEnabled ? '📹' : '🚫'}
          </button>
          <button
            onClick={handleScreenShare}
            disabled={!localStream}
            className="p-2 rounded-full glass text-xs disabled:opacity-30"
            title="Share screen"
          >
            🖥️
          </button>
        </div>

        {/* File tabs + viewer */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          <div className="flex gap-2 mb-3 overflow-x-auto shrink-0">
            {files.map((f, idx) => (
              <button
                key={f.fileId}
                onClick={() => setSelectedFile(idx)}
                className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  selectedFile === idx
                    ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                    : 'glass text-gray-400 dark:text-white/60 hover:text-gray-600 dark:hover:text-white'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="flex-1 glass rounded-xl flex items-center justify-center min-h-[150px] overflow-hidden">
            {currentFile ? (
              currentFile.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(currentFile.data)}
                  alt={currentFile.name}
                  className="max-w-full max-h-64 rounded-lg object-contain"
                />
              ) : currentFile.type === 'application/pdf' ? (
                <object
                  data={URL.createObjectURL(currentFile.data)}
                  type="application/pdf"
                  className="w-full h-full min-h-[300px] rounded-lg"
                >
                  <p className="text-gray-400 dark:text-white/30">
                    PDF cannot be displayed.{' '}
                    <a
                      href={URL.createObjectURL(currentFile.data)}
                      download={currentFile.name}
                      className="text-accent-cyan hover:underline"
                    >
                      Download instead
                    </a>
                  </p>
                </object>
              ) : (
                <a
                  href={URL.createObjectURL(currentFile.data)}
                  download={currentFile.name}
                  className="btn-primary text-sm"
                >
                  Download {currentFile.name}
                </a>
              )
            ) : (
              <span className="text-gray-400 dark:text-white/30">File preview here</span>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`flex flex-col gap-2 flex-1 lg:max-w-xs min-w-0 ${mobileTab !== 'sidebar' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="card p-3">
          <div className="font-semibold text-sm mb-2">Upload Files</div>
          <div className="border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl p-6 text-center hover:border-accent-purple/30 transition-colors">
            <input
              type="file"
              id="roomFileInput"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <label
              htmlFor="roomFileInput"
              className="cursor-pointer text-sm text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70"
            >
              {uploading ? 'Uploading...' : 'Drag & drop or click to browse'}
            </label>
          </div>
        </div>
        <div className="card flex-1 p-3 overflow-y-auto">
          <div className="font-semibold text-sm mb-2">Users ({users.length})</div>
          <ul className="space-y-1">
            {users.map((u) => (
              <li key={u.userId} className="flex items-center justify-between text-sm py-1">
                <span>
                  {u.username}
                  {u.userId === userId && <span className="text-accent-cyan text-xs ml-1">(You)</span>}
                </span>
                {isAdmin && u.userId !== userId && (
                  <button
                    onClick={() => handleKick(u.userId)}
                    className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                  >
                    Kick
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-gray-200 dark:border-white/5 flex items-stretch">
        {(['video', 'chat', 'sidebar'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              mobileTab === tab
                ? 'text-accent-purple bg-accent-purple/10 border-t-2 border-accent-purple'
                : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70'
            }`}
          >
            {tab === 'video' ? '📹 Video' : tab === 'chat' ? '💬 Chat' : '📁 Files'}
          </button>
        ))}
      </div>
    </div>
  )
}
