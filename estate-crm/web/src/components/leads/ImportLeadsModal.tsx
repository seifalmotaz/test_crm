import { useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  parseLeadsFromRows,
  parseCsv,
  downloadBlob,
  type ParsedLeadRow,
} from '../../lib/leads-io';
import { LEAD_SOURCE_LABELS, LEAD_TYPE_LABELS } from '../../types/leads';

const SAMPLE_CSV = `name,phone,email,source,type,preferredLocation,preferredType,budgetMin,budgetMax,timeline,notes
Ahmed Hassan,+201001234567,ahmed@example.com,website,buyer,New Cairo,apartment,10000000,30000000,3,Looking for 3BR
Sara Ali,+201555123456,sara@example.com,referral,seller,Maadi,villa,,,6,Selling family villa`;

interface ImportLeadsModalProps {
  onClose: () => void;
  onConfirm: (rows: ParsedLeadRow['data'][]) => Promise<{
    created: number;
    failed: number;
  }>;
}

export default function ImportLeadsModal({ onClose, onConfirm }: ImportLeadsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedLeadRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ created: number; failed: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const { headers: h, rows: r } = parseCsv(text);
        if (h.length === 0 || r.length === 0) {
          setParseError('File appears to be empty or has no data rows.');
          setRows([]);
          return;
        }
        const parsed = parseLeadsFromRows(h, r);
        setRows(parsed);
      } catch (err: any) {
        setParseError(`Failed to read file: ${err?.message || 'Unknown error'}`);
      }
    };
    reader.onerror = () => setParseError('Failed to read file');
    reader.readAsText(file);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    downloadBlob('leads-import-sample.csv', blob);
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  async function handleConfirm() {
    if (validRows.length === 0) return;
    setSubmitting(true);
    try {
      const result = await onConfirm(validRows.map((r) => r.data));
      setSubmitResult(result);
    } catch (err: any) {
      setParseError(err?.detail || err?.message || 'Failed to import leads');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-card card-border rounded-2xl w-full max-w-md p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <p className="text-white font-semibold">Import complete</p>
          </div>
          <p className="text-slate-300 text-sm">
            Created <span className="text-emerald-400 font-semibold">{submitResult.created}</span>{' '}
            {submitResult.created === 1 ? 'lead' : 'leads'}.
            {submitResult.failed > 0 && (
              <>
                {' '}
                <span className="text-red-400 font-semibold">{submitResult.failed}</span> failed.
              </>
            )}
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-sm font-semibold text-white transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card card-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-blue-400" />
            <h2 className="text-white text-sm font-semibold">Import Leads</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* File picker */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              CSV File
            </label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/20 hover:bg-white/3 p-6 transition-all">
              <Upload size={20} className="text-slate-500" />
              <p className="text-slate-300 text-xs">
                {fileName ? (
                  <span className="text-blue-400">{fileName}</span>
                ) : (
                  <>
                    Drop a CSV file or <span className="text-blue-400 underline">browse</span>
                  </>
                )}
              </p>
              <p className="text-slate-600 text-[10px]">Export your Excel sheet as "CSV UTF-8" before uploading</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </label>
            <button
              onClick={downloadSample}
              className="self-start text-[10px] text-blue-400 hover:text-blue-300 underline transition-colors"
            >
              Download sample CSV
            </button>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs">{parseError}</p>
            </div>
          )}

          {/* Required columns hint */}
          {rows.length === 0 && (
            <div className="p-3 bg-white/3 border border-white/8 rounded-xl">
              <p className="text-slate-300 text-xs font-medium mb-2">Required columns</p>
              <p className="text-slate-500 text-[10px] mb-2">
                These columns are recognized (case-insensitive, aliases supported):
              </p>
              <div className="flex flex-wrap gap-1">
                {['name', 'phone', 'source', 'type', 'email', 'preferredLocation', 'budgetMin', 'budgetMax', 'timeline', 'notes'].map((c) => (
                  <code key={c} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-blue-300">
                    {c}
                  </code>
                ))}
              </div>
              <p className="text-slate-500 text-[10px] mt-3">
                Valid source values: {Object.keys(LEAD_SOURCE_LABELS).join(', ')}
              </p>
              <p className="text-slate-500 text-[10px]">
                Valid type values: {Object.keys(LEAD_TYPE_LABELS).join(', ')}
              </p>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-300 text-xs">
                  Preview ·{' '}
                  <span className="text-emerald-400">{validRows.length} valid</span>
                  {errorRows.length > 0 && (
                    <>
                      {' · '}
                      <span className="text-red-400">{errorRows.length} with errors</span>
                    </>
                  )}
                </p>
                <p className="text-slate-500 text-[10px]">{rows.length} total rows</p>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead className="bg-white/5 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-slate-400 font-medium">Row</th>
                        <th className="px-2 py-1.5 text-slate-400 font-medium">Name</th>
                        <th className="px-2 py-1.5 text-slate-400 font-medium">Phone</th>
                        <th className="px-2 py-1.5 text-slate-400 font-medium">Source</th>
                        <th className="px-2 py-1.5 text-slate-400 font-medium">Type</th>
                        <th className="px-2 py-1.5 text-slate-400 font-medium">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 100).map((r) => (
                        <tr
                          key={r.rowIndex}
                          className={
                            r.errors.length > 0
                              ? 'bg-red-500/5 border-b border-white/3'
                              : 'border-b border-white/3'
                          }
                        >
                          <td className="px-2 py-1.5 text-slate-500">{r.rowIndex}</td>
                          <td className="px-2 py-1.5 text-slate-200">{r.data.name || '—'}</td>
                          <td className="px-2 py-1.5 text-slate-300">{r.data.phone || '—'}</td>
                          <td className="px-2 py-1.5 text-slate-300">{r.data.source}</td>
                          <td className="px-2 py-1.5 text-slate-300">{r.data.type}</td>
                          <td className="px-2 py-1.5 text-red-300">
                            {r.errors.length > 0 ? r.errors.join(', ') : '✓'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 100 && (
                  <p className="px-2 py-1.5 text-[10px] text-slate-500 bg-white/3 border-t border-white/5">
                    Showing first 100 rows · {rows.length - 100} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || validRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-xs font-medium rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            {submitting ? 'Importing...' : `Import ${validRows.length} lead${validRows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}