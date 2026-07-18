import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Lottie from 'lottie-react'
import transferAnimation from './assets/Files Transfer  Sharing.json'

const MESSAGES = [
  'Transfer files with a flick of a finger.',
  'Let our ROCKET do your work!',
  'Secure. Fast. Ephemeral.',
]

export default function Home() {
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const cycle = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % MESSAGES.length)
        setFade(true)
      }, 500)
    }, 5000)
    return () => clearInterval(cycle)
  }, [])

  const handleGetStarted = useCallback(() => {
    window.location.href = '/upload'
  }, [])

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden flex items-center justify-center">
      <Lottie
        animationData={transferAnimation}
        loop
        className="absolute inset-0 w-full h-full opacity-30 sm:opacity-40 pointer-events-none"
        style={{ objectFit: 'cover' }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/40 to-white/90 dark:from-dark/60 dark:via-dark/40 dark:to-dark/90 pointer-events-none" />

      <div className="relative z-10 text-center px-4 max-w-3xl mx-auto animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 rounded-full glass text-xs sm:text-sm text-gray-500 dark:text-white/70 mb-6 sm:mb-8">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent-emerald animate-pulse" />
          Secure P2P Transfers
        </div>

        <h1
          className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4 sm:mb-6 px-2"
          style={{
            opacity: fade ? 1 : 0,
            transition: 'opacity 0.5s',
          }}
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-teal">
            {MESSAGES[index]}
          </span>
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-gray-500 dark:text-white/50 mb-8 sm:mb-10 max-w-xl mx-auto px-2">
          Upload files, share instantly with a code, or create ephemeral chat rooms that vanish without a trace.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
          <button onClick={handleGetStarted} className="btn-primary w-full sm:w-auto text-sm sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3">
            Get Started
          </button>
          <Link to="/ghostlink" className="btn-secondary w-full sm:w-auto text-sm sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 text-center">
            Ghostlink Rooms
          </Link>
        </div>
      </div>
    </div>
  )
}
