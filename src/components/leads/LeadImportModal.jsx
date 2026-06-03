import { useState, useRef } from 'react'
import { X, Upload, Download, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '../../lib/api'

const REQUIRED_COLS = ['name', 'email', 'phone']
const ALL_COLS = ['name', 'email', 'phone', 'type', 'source', 'budget', 'interest', 'location', 'timeline', 'stage', 'notes']
const VALID_TYPES    = ['Individual', 'Family', 'Investor', 'Corporate']
const VALID_SOURCES  = ['Referral', 'Website', 'Social Media', 'Cold Call', 'Portal (Zillow)']
const VALID_STAGES   = ['freshLead', 'qualified', 'callBack', 'followUp', 'notInterested', 'lowBudget', 'reservation']
const VALID_INTERESTS = ['Apartment', 'Villa', 'Commercial', 'Townhouse', 'Land']

function normaliseRow(raw) {
  const r = {}
  for (const k of Object.keys(raw)) r[k.trim().toLowerCase()] = String(raw[k] ?? '').trim()
  return {
    name:     r.name || '',
    email:    r.email || '',
    phone:    r.phone || '',
    type:     VALID_TYPES.includes(r.type) ? r.type : 'Individual',
    source:   VALID_SOURCES.includes(r.source) ? r.source : 'Website',
    budget:   parseFloat(r.budget) || 0,
    interest: VALID_INTERESTS.includes(r.interest) ? r.interest : 'Apartment',
    location: r.location || '',
    timeline: parseInt(r.timeline) || 30,
    stage:    VALID_STAGES.includes(r.stage) ? r.stage : 'freshLead',
    notes:    r.notes || '',
  }
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ALL_COLS,
    ['Jane Smith', 'jane@example.com', '+1 555 000 0000', 'Individual', 'Website', '1000000', 'Apartment', 'Downtown', '30', 'freshLead', 'Sample note'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads')
  XLSX.writeFile(wb, 'leads_import_template.xlsx')
}

export default function LeadImportModal({ agents, onClose, onDone }) {
  const inputRef = useRef(null)
  const [rows, setRows]         = useState([])
  const [errors, setErrors]     = useState([])
  const [agentId, setAgentId]   = useState(agents[0]?.id || '')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })
  const [finished, setFinished] = useState(false)

  function parseFile(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (raw.length === 0) { setErrors(['The file is empty or has no data rows.']); return }
        const parsed = raw.map(normaliseRow)
        const errs = []
        parsed.forEach((r, i) => {
          if (!r.name)  errs.push(`Row ${i + 2}: Name is required`)
          if (!r.email) errs.push(`Row ${i + 2}: Email is required`)
          if (!r.phone) errs.push(`Row ${i + 2}: Phone is required`)
        })
        setErrors(errs)
        setRows(parsed)
      } catch {
        setErrors(['Could not read file. Make sure it is a valid .xlsx or .csv file.'])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setRows([])
    setErrors([])
    setFinished(false)
    parseFile(file)
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.name && r.email && r.phone)
    if (!validRows.length || !agentId) return
    setImporting(true)
    setProgress({ done: 0, total: validRows.length, failed: 0 })

    let failed = 0
    for (let i = 0; i < validRows.length; i++) {
      try {
        const r = validRows[i]
        await api.post('/api/leads', {
          ...r,
          agentId,
          avatar: r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
          color:  '#3b82f6',
          readiness: 0,
        })
      } catch {
        failed++
      }
      setProgress({ done: i + 1, total: validRows.length, failed })
    }

    setImporting(false)
    setFinished(true)
    if (failed < validRows.length) onDone()
  }

  const validCount = rows.filter(r => r.name && r.email && r.phone).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card card-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-400" />
            <h2 className="text-white font-semibold">Import Leads from Excel</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* Template download */}
          <div className="flex items-center justify-between p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl">
            <div>
              <p className="text-blue-300 text-sm font-medium">Download Template</p>
              <p className="text-slate-500 text-xs mt-0.5">Fill this file with your leads data, then upload it below</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-all"
            >
              <Download size={13} /> Template
            </button>
          </div>

          {/* File drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-white/15 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/40 hover:bg-white/2 transition-all"
          >
            <Upload size={24} className="text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 text-sm font-medium">Click to select file</p>
            <p className="text-slate-600 text-xs mt-1">Supports .xlsx, .xls, .csv</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3 space-y-1">
              {errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-red-400 text-xs flex items-start gap-2">
                  <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" /> {e}
                </p>
              ))}
              {errors.length > 5 && <p className="text-slate-500 text-xs">…and {errors.length - 5} more</p>}
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs mb-2">
                <span className="text-white font-semibold">{validCount}</span> valid rows detected
                {rows.length - validCount > 0 && <span className="text-red-400"> · {rows.length - validCount} invalid (will be skipped)</span>}
              </p>
              <div className="overflow-x-auto rounded-xl border border-white/8">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      {['Name', 'Email', 'Phone', 'Type', 'Budget', 'Stage'].map(h => (
                        <th key={h} className="text-left text-slate-500 px-3 py-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => {
                      const valid = r.name && r.email && r.phone
                      return (
                        <tr key={i} className={`border-b border-white/5 ${!valid ? 'opacity-40' : ''}`}>
                          <td className="px-3 py-2 text-slate-300">{r.name || <span className="text-red-400">missing</span>}</td>
                          <td className="px-3 py-2 text-slate-400">{r.email || <span className="text-red-400">missing</span>}</td>
                          <td className="px-3 py-2 text-slate-400">{r.phone || <span className="text-red-400">missing</span>}</td>
                          <td className="px-3 py-2 text-slate-500">{r.type}</td>
                          <td className="px-3 py-2 text-slate-500">{r.budget ? `$${(r.budget / 1000).toFixed(0)}K` : '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{r.stage}</td>
                        </tr>
                      )
                    })}
                    {rows.length > 8 && (
                      <tr><td colSpan={6} className="px-3 py-2 text-slate-600 text-center">…{rows.length - 8} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Agent selector */}
          {rows.length > 0 && agents.length > 0 && (
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Assign all imported leads to:</label>
              <select
                value={agentId}
                onChange={e => setAgentId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
              >
                {agents.map(a => <option key={a.id} value={a.id} className="bg-slate-800">{a.name}</option>)}
              </select>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="bg-white/4 border border-white/8 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="text-slate-300">Importing leads…</span>
                <span className="text-white font-semibold">{progress.done} / {progress.total}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              {progress.failed > 0 && (
                <p className="text-amber-400 text-xs mt-2">{progress.failed} rows failed (duplicates or invalid data)</p>
              )}
            </div>
          )}

          {/* Done state */}
          {finished && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
              <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-emerald-300 text-sm font-medium">
                  {progress.done - progress.failed} leads imported successfully
                </p>
                {progress.failed > 0 && (
                  <p className="text-slate-400 text-xs mt-0.5">{progress.failed} skipped (duplicates or errors)</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-white/8 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/8 transition-all"
          >
            {finished ? 'Close' : 'Cancel'}
          </button>
          {!finished && (
            <button
              onClick={handleImport}
              disabled={validCount === 0 || importing || !agentId}
              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 rounded-xl text-sm font-semibold text-white transition-all"
            >
              {importing ? `Importing ${progress.done}/${progress.total}…` : `Import ${validCount} Lead${validCount !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
