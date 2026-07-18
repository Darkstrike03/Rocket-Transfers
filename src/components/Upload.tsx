import { useState, useRef, useCallback } from 'react'
import Lottie from 'lottie-react'
import loadingAnimation from './assets/loading.json'
import { supabase } from '../lib/supabase'

const TIME_OPTIONS = [
  { label: '1 Hour', value: '1h' },
  { label: '1 Day', value: '1d' },
  { label: '1 Week', value: '1w' },
] as const

function generateCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

export default function Upload() {
  const [files, setFiles] = useState<File[]>([])
  const [timeLimit, setTimeLimit] = useState<string>('1h')
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<File[]>([])
  const [done, setDone] = useState(false)
  const [specialCode, setSpecialCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    setFiles((prev) => [...prev, ...dropped])
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files))
  }, [])

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const handleUpload = useCallback(async () => {
    if (!files.length) return
    setUploading(true)
    setError(null)

    const code = generateCode()
    const uploadedList: File[] = []

    try {
      for (const file of files) {
        const { error: uploadError } = await supabase.storage
          .from('files')
          .upload(`${code}/${file.name}`, file)
        if (uploadError) throw uploadError
        uploadedList.push(file)
      }

      const { error: dbError } = await supabase.from('transfers').insert([
        { code, file_names: files.map((f) => f.name), time_limit: timeLimit },
      ])
      if (dbError) throw dbError

      setUploaded(uploadedList)
      setFiles([])
      setSpecialCode(code)
      setUploading(false)
    } catch (err: unknown) {
      setUploading(false)
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }, [files, timeLimit])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(specialCode)
  }, [specialCode])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-6">
        {!done && (
          <div className="card animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Upload Files</h2>
              <p className="text-gray-500 dark:text-white/50 mt-1">Drag & drop or select files to share</p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-white/10 rounded-2xl p-10 text-center cursor-pointer hover:border-accent-purple/50 hover:bg-accent-purple/5 transition-all duration-300"
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="text-4xl mb-3 opacity-30">📁</div>
              <p className="text-gray-500 dark:text-white/60">
                {files.length
                  ? `${files.length} file(s) selected`
                  : 'Drop files here or click to browse'}
              </p>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between glass rounded-xl px-4 py-2.5"
                  >
                    <span className="text-sm truncate max-w-[60%]">{f.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 dark:text-white/40">{(f.size / 1024).toFixed(1)} KB</span>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-5">
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="select-field sm:w-40"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <button
                onClick={handleUpload}
                disabled={!files.length || uploading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Lottie
                      animationData={loadingAnimation}
                      style={{ width: 24, height: 24 }}
                    />
                    Uploading...
                  </>
                ) : (
                  'Upload!'
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {uploaded.length > 0 && !done && (
          <div className="card animate-slide-up">
            <h3 className="font-semibold mb-4">Preview</h3>
            <div className="space-y-2">
              {uploaded.map((f, idx) => (
                <div key={idx} className="flex items-center justify-between glass rounded-xl px-4 py-2.5">
                  <span className="text-sm">{f.name}</span>
                  <span className="text-xs text-gray-400 dark:text-white/40">
                    {TIME_OPTIONS.find((o) => o.value === timeLimit)?.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <button onClick={() => setDone(true)} className="btn-primary">
                Done
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="card animate-slide-up text-center">
            <h3 className="text-2xl font-bold mb-2">Files Uploaded! 🚀</h3>
            <p className="text-gray-500 dark:text-white/50 mb-6">Share this code with anyone to let them download</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <code className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-xl sm:text-2xl font-mono tracking-widest select-all w-full sm:w-auto text-center break-all">
                {specialCode}
              </code>
              <button
                onClick={handleCopy}
                className="btn-secondary px-4 py-3 text-sm w-full sm:w-auto"
              >
                Copy
              </button>
            </div>

            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${specialCode}`}
              alt="QR Code"
              className="mx-auto rounded-xl"
              style={{ width: 150, height: 150 }}
            />

            <p className="text-gray-400 dark:text-white/30 text-sm mt-4">
              This code will expire after the selected time limit.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
