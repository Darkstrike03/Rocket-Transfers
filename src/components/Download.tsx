import { useState, useCallback } from 'react'
import Lottie from 'lottie-react'
import loadingAnimation from './assets/loading.json'
import { supabase } from '../lib/supabase'
import JSZip from 'jszip'
import type { Transfer } from '../types'

export default function Download() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<{ name: string; url: string }[]>([])
  const [showFiles, setShowFiles] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = useCallback(async () => {
    if (!code.trim()) return
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('transfers')
        .select('file_names, created_at, time_limit')
        .eq('code', code.trim())
        .single<Transfer>()

      if (fetchError || !data) throw new Error('Invalid code or no files found.')

      const created = new Date(data.created_at)
      if (data.time_limit === '1h') created.setHours(created.getHours() + 1)
      else if (data.time_limit === '1d') created.setDate(created.getDate() + 1)
      else if (data.time_limit === '1w') created.setDate(created.getDate() + 7)

      if (new Date() > created) {
        setLoading(false)
        setError('This code has expired.')
        return
      }

      const fileList = await Promise.all(
        data.file_names.map(async (fileName: string) => {
          const { data: signedData } = await supabase.storage
            .from('files')
            .createSignedUrl(`${code.trim()}/${fileName}`, 60 * 5)
          return { name: fileName, url: signedData!.signedUrl }
        }),
      )

      setFiles(fileList)
      setShowFiles(true)
      setLoading(false)
    } catch (err: unknown) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }, [code])

  const downloadFile = useCallback(
    async (file: { name: string; url: string }) => {
      const zip = new JSZip()
      try {
        const res = await fetch(file.url)
        const blob = await res.blob()
        zip.file(file.name, blob)
        const content = await zip.generateAsync({ type: 'blob' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(content)
        link.download = `${file.name.replace(/\.[^/.]+$/, '')}.zip`
        link.click()
        URL.revokeObjectURL(link.href)
      } catch {
        alert('Failed to download file.')
      }
    },
    [],
  )

  const downloadAll = useCallback(async () => {
    if (!files.length) return
    const zip = new JSZip()
    await Promise.all(
      files.map(async (file) => {
        const res = await fetch(file.url)
        const blob = await res.blob()
        zip.file(file.name, blob)
      }),
    )
    const content = await zip.generateAsync({ type: 'blob' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(content)
    link.download = 'files.zip'
    link.click()
    URL.revokeObjectURL(link.href)
  }, [files])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg space-y-6">
        {!showFiles && (
          <div className="card animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Download Files</h2>
              <p className="text-gray-500 dark:text-white/50 mt-1">Enter the code you received</p>
            </div>

            <input
              type="text"
              className="input-field text-center text-xl tracking-[0.3em] font-mono"
              placeholder="XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={16}
            />

            <button
              onClick={handleDownload}
              disabled={!code.trim() || loading}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Lottie animationData={loadingAnimation} style={{ width: 24, height: 24 }} />
                  Loading...
                </>
              ) : (
                'Download'
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {showFiles && (
          <div className="card animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Files ({files.length})</h3>
              <button onClick={downloadAll} className="btn-primary text-sm px-4 py-1.5">
                Download All
              </button>
            </div>

            <div className="space-y-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between glass rounded-xl px-4 py-3"
                >
                  <span className="text-sm truncate max-w-[60%]">{file.name}</span>
                  <button
                    onClick={() => downloadFile(file)}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-accent-emerald/20 text-accent-emerald hover:bg-accent-emerald/30 transition-colors"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
