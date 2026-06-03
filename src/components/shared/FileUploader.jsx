import { useState, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import { upload } from '../../lib/api'

function fmtBytes(b) {
  if (b < 1024)        return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileUploader({ entityType, entityId, onUploadSuccess, accept, hint }) {
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(null)  // null | 0–100
  const [uploaded, setUploaded] = useState(null)  // file record from API
  const [error,    setError]    = useState('')
  const inputRef = useRef(null)

  function reset() {
    setProgress(null)
    setUploaded(null)
    setError('')
  }

  async function handleFile(file) {
    setError('')
    setUploaded(null)
    setProgress(0)

    const formData = new FormData()
    formData.append('file',       file)
    formData.append('entityType', entityType)
    formData.append('entityId',   entityId)

    try {
      const res = await upload('/api/files/upload', formData, pct => setProgress(pct))
      setUploaded(res.data)
      onUploadSuccess?.(res.data)
    } catch (err) {
      setError(err.message || 'Upload failed')
      setProgress(null)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onInputChange(e) {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  // Uploading
  if (progress !== null && !uploaded) {
    return (
      <div className="bg-white/3 border border-white/8 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={13} className="text-blue-400 flex-shrink-0" />
          <span className="text-slate-300 text-xs flex-1 truncate">Uploading…</span>
          <span className="text-slate-500 text-[10px]">{progress}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  // Success
  if (uploaded) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
          <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-xs font-medium truncate">{uploaded.originalName}</p>
            <p className="text-slate-500 text-[10px]">{fmtBytes(uploaded.size)}</p>
          </div>
          <a
            href={uploaded.url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 text-[10px] hover:text-blue-300 transition-colors flex-shrink-0"
          >
            Download
          </a>
          <button
            onClick={reset}
            className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 ml-1"
          >
            <X size={12} />
          </button>
        </div>
        <button
          onClick={reset}
          className="w-full py-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors text-center"
        >
          + Upload another file
        </button>
      </div>
    )
  }

  // Drop zone
  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-blue-400/60 bg-blue-500/8'
            : 'border-white/10 hover:border-white/20 hover:bg-white/3'
        }`}
      >
        <Upload
          size={18}
          className={`mx-auto mb-1.5 transition-colors ${dragging ? 'text-blue-400' : 'text-slate-500'}`}
        />
        <p className="text-slate-400 text-xs">
          Drop a file or{' '}
          <span className="text-blue-400 underline underline-offset-2">browse</span>
        </p>
        <p className="text-slate-600 text-[10px] mt-0.5">{hint ?? 'Any type · Max 25 MB'}</p>
        <input ref={inputRef} type="file" className="hidden" accept={accept} onChange={onInputChange} />
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle size={12} className="flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
