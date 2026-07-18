import { useState, useEffect, useCallback } from 'react'
import Lottie from 'lottie-react'
import gradientLoading from './assets/gradient loading.json'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'

const TIME_OPTIONS = [
  { label: '5 min', value: '5m' },
  { label: '30 min', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '2 hours', value: '2h' },
  { label: '5 hours', value: '5h' },
] as const

type Step = 'info' | 'create' | 'enter'

export default function Ghostlink() {
  const [showTransition, setShowTransition] = useState(true)
  const [step, setStep] = useState<Step>('info')
  const [username, setUsername] = useState('')
  const [timeLimit, setTimeLimit] = useState('1h')
  const [code, setCode] = useState('')
  const [joinModal, setJoinModal] = useState(false)
  const [joinAdmin, setJoinAdmin] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { toggle } = useTheme()

  useEffect(() => {
    const t = setTimeout(() => setShowTransition(false), 1200)
    return () => clearTimeout(t)
  }, [])

  const handleStartRoom = useCallback(async () => {
    if (!username) {
      setError('Username is required.')
      return
    }
    const roomCode = Math.random().toString(36).substr(2, 8).toUpperCase()

    const { error: insertError } = await supabase.from('rooms').insert([
      { code: roomCode, admin_username: username, time_limit: timeLimit },
    ])

    if (insertError) {
      setError('Failed to create room: ' + insertError.message)
      return
    }

    window.open(
      `/room?username=${encodeURIComponent(username)}&code=${encodeURIComponent(roomCode)}&admin=1`,
      '_blank',
    )
  }, [username, timeLimit])

  const handleJoinRoom = useCallback(async () => {
    if (!username) {
      setError('Username is required.')
      return
    }
    if (!code) {
      setError('Room code is required.')
      return
    }

    const { data, error: fetchError } = await supabase
      .from('rooms')
      .select('admin_username')
      .eq('code', code)
      .single<{ admin_username: string }>()

    if (fetchError || !data) {
      setError('Invalid code or room not found.')
      return
    }

    setJoinModal(true)
    setJoinAdmin(data.admin_username)
    setJoinRoomCode(code)
  }, [username, code])

  const confirmJoin = useCallback(() => {
    window.open(
      `/room?username=${encodeURIComponent(username)}&code=${encodeURIComponent(joinRoomCode)}`,
      '_blank',
    )
    setJoinModal(false)
  }, [username, joinRoomCode])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center relative px-4">
      {showTransition && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900 dark:bg-[#18191a]">
          <Lottie animationData={gradientLoading} style={{ width: 160, height: 160 }} loop={false} />
        </div>
      )}

      {!showTransition && (
        <div className="w-full max-w-md animate-fade-in">
          {step === 'info' && (
            <div className="card text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-accent-purple to-accent-cyan">
                👻 Ghostlink
              </h2>
              <p className="text-sm sm:text-base text-gray-500 dark:text-white/50 mb-6">
                Create a one-time, self-destructing chat room. Share a code, chat securely, and vanish without a trace.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => setStep('create')} className="btn-primary w-full sm:w-auto">
                  Create Room
                </button>
                <button onClick={() => setStep('enter')} className="btn-secondary w-full sm:w-auto">
                  Enter Room
                </button>
              </div>
              <div className="mt-6 text-xs text-gray-400 dark:text-white/30">
                <button onClick={toggle} className="hover:text-gray-600 dark:hover:text-white/60 transition-colors">
                  Switch to {document.documentElement.classList.contains('dark') ? 'light' : 'dark'} mode
                </button>
              </div>
            </div>
          )}

          {step === 'create' && (
            <div className="card text-center">
              <h3 className="text-lg sm:text-xl font-bold mb-4">Create Room</h3>
              <input
                type="text"
                className="input-field mb-3"
                placeholder="Your username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null) }}
                autoFocus
              />
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="select-field mb-4"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={handleStartRoom}
                disabled={!username}
                className="btn-primary w-full"
              >
                Start Room
              </button>
              <button
                onClick={() => { setStep('info'); setError(null) }}
                className="text-sm text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70 mt-3 transition-colors"
              >
                Back
              </button>
              {error && (
                <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'enter' && (
            <div className="card text-center">
              <h3 className="text-lg sm:text-xl font-bold mb-4">Enter Room</h3>
              <input
                type="text"
                className="input-field mb-3"
                placeholder="Your username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null) }}
                autoFocus
              />
              <input
                type="text"
                className="input-field mb-4"
                placeholder="Room code"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }}
              />
              <button
                onClick={handleJoinRoom}
                disabled={!username || !code}
                className="btn-primary w-full"
              >
                Enter Room
              </button>
              <button
                onClick={() => { setStep('info'); setError(null) }}
                className="text-sm text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70 mt-3 transition-colors"
              >
                Back
              </button>
              {error && (
                <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {joinModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm p-4">
          <div className="card text-center max-w-sm w-full mx-4 animate-fade-in">
            <h4 className="text-base sm:text-lg mb-2">
              Join <span className="text-accent-purple font-semibold">{joinAdmin}</span>'s room?
            </h4>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
              <button onClick={confirmJoin} className="btn-primary w-full sm:w-auto">
                Yes, Join
              </button>
              <button
                onClick={() => setJoinModal(false)}
                className="btn-secondary w-full sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
