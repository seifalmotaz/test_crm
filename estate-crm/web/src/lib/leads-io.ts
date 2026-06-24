import type { LeadResponseDto } from '../api/types.gen';

export interface ParsedLeadRow {
  rowIndex: number;
  raw: Record<string, string>;
  data: {
    name: string;
    email?: string;
    phone: string;
    source: string;
    type: string;
    notes?: string;
    preferredLocation?: string;
    preferredType?: string;
    budgetMin?: number;
    budgetMax?: number;
    timeline?: number;
    agentId?: string;
  };
  errors: string[];
}

const HEADER_ALIASES: Record<keyof ParsedLeadRow['data'], string[]> = {
  name: ['name', 'full name', 'lead name', 'fullname'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['phone', 'mobile', 'tel', 'telephone', 'phone number'],
  source: ['source', 'lead source'],
  type: ['type', 'lead type'],
  notes: ['notes', 'note', 'comments'],
  preferredLocation: ['preferred location', 'location', 'preferredlocation'],
  preferredType: ['preferred type', 'preferredtype'],
  budgetMin: ['budget min', 'min budget', 'budgetmin'],
  budgetMax: ['budget max', 'max budget', 'budgetmax'],
  timeline: ['timeline', 'months', 'timeframe'],
  agentId: ['agent id', 'agentid', 'assigned to'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function findHeader(headers: string[], field: keyof ParsedLeadRow['data']): number {
  const aliases = HEADER_ALIASES[field].map(normalizeHeader);
  for (let i = 0; i < headers.length; i++) {
    if (aliases.includes(normalizeHeader(headers[i]))) return i;
  }
  return -1;
}

const VALID_SOURCES = new Set([
  'website', 'referral', 'social_media', 'walk_in', 'cold_call', 'advertisement', 'portal', 'other',
]);

const VALID_TYPES = new Set(['buyer', 'seller', 'renter', 'investor']);

function parseNumber(v: string): number | undefined {
  if (!v) return undefined;
  const trimmed = v.trim().replace(/[, $]/g, '');
  if (!trimmed) return undefined;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function parseLeadsFromRows(
  headers: string[],
  rows: string[][],
): ParsedLeadRow[] {
  const idx = {
    name: findHeader(headers, 'name'),
    email: findHeader(headers, 'email'),
    phone: findHeader(headers, 'phone'),
    source: findHeader(headers, 'source'),
    type: findHeader(headers, 'type'),
    notes: findHeader(headers, 'notes'),
    preferredLocation: findHeader(headers, 'preferredLocation'),
    preferredType: findHeader(headers, 'preferredType'),
    budgetMin: findHeader(headers, 'budgetMin'),
    budgetMax: findHeader(headers, 'budgetMax'),
    timeline: findHeader(headers, 'timeline'),
    agentId: findHeader(headers, 'agentId'),
  };

  return rows.map((row, i) => {
    const get = (fieldIdx: number) =>
      fieldIdx >= 0 && fieldIdx < row.length ? (row[fieldIdx] ?? '').toString().trim() : '';
    const raw: Record<string, string> = {};
    headers.forEach((h, j) => {
      raw[h] = row[j]?.toString() ?? '';
    });

    const name = get(idx.name);
    const phone = get(idx.phone);
    const source = get(idx.source).toLowerCase().replace(/[\s-]+/g, '_');
    const type = get(idx.type).toLowerCase();
    const email = get(idx.email);
    const notes = get(idx.notes);

    const errors: string[] = [];
    if (!name) errors.push('name is required');
    if (!phone) errors.push('phone is required');
    if (!source) errors.push('source is required');
    else if (!VALID_SOURCES.has(source)) errors.push(`source '${source}' is not valid`);
    if (!type) errors.push('type is required');
    else if (!VALID_TYPES.has(type)) errors.push(`type '${type}' is not valid`);

    return {
      rowIndex: i + 2, // header is row 1
      raw,
      data: {
        name,
        phone,
        source: source || 'other',
        type: type || 'buyer',
        email: email || undefined,
        notes: notes || undefined,
        preferredLocation: get(idx.preferredLocation) || undefined,
        preferredType: get(idx.preferredType).toLowerCase() || undefined,
        budgetMin: parseNumber(get(idx.budgetMin)),
        budgetMax: parseNumber(get(idx.budgetMax)),
        timeline: parseNumber(get(idx.timeline)),
        agentId: get(idx.agentId) || undefined,
      },
      errors,
    };
  });
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

// ─── XLSX parsing via lightweight SheetJS-compatible path ───
//
// To avoid adding a heavy dependency, we ship CSV-only for import. Excel
// users can save as "CSV UTF-8" before uploading. Export supports both
// CSV (no deps) and XLSX via a small XML-based fallback if a library is
// available at runtime, otherwise we emit CSV.

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const LEAD_EXPORT_COLUMNS: { header: string; get: (l: LeadResponseDto) => string | number | undefined }[] = [
  { header: 'name', get: (l) => l.name },
  { header: 'phone', get: (l) => l.phone },
  { header: 'email', get: (l) => l.email ?? '' },
  { header: 'source', get: (l) => l.source },
  { header: 'type', get: (l) => l.type },
  { header: 'stage', get: (l) => l.stage },
  { header: 'score', get: (l) => l.score },
  { header: 'budgetMin', get: (l) => l.budgetMin ?? '' },
  { header: 'budgetMax', get: (l) => l.budgetMax ?? '' },
  { header: 'timeline', get: (l) => l.timeline ?? '' },
  { header: 'preferredLocation', get: (l) => l.preferredLocation ?? '' },
  { header: 'preferredType', get: (l) => l.preferredType ?? '' },
  { header: 'agentId', get: (l) => l.agentId ?? '' },
  { header: 'notes', get: (l) => l.notes ?? '' },
  { header: 'nextAction', get: (l) => l.nextAction ?? '' },
  { header: 'nextActionDate', get: (l) => l.nextActionDate ?? '' },
  { header: 'isDnc', get: (l) => (l.isDnc ? 'true' : 'false') },
  { header: 'isClient', get: (l) => (l.isClient ? 'true' : 'false') },
  { header: 'createdAt', get: (l) => l.createdAt },
];

function escapeCsv(v: string | number | undefined): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function exportLeadsAsCsv(leads: LeadResponseDto[]): Blob {
  const headers = LEAD_EXPORT_COLUMNS.map((c) => c.header);
  const lines: string[] = [];
  lines.push(headers.join(','));
  for (const lead of leads) {
    lines.push(LEAD_EXPORT_COLUMNS.map((c) => escapeCsv(c.get(lead))).join(','));
  }
  return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
}

// Minimal SpreadsheetML XML so .xls opens in Excel without dependencies.
// Not full XLSX (Office Open XML) — uses old XMLSS for max compatibility
// with both Excel and LibreOffice.
function buildXmlss(leads: LeadResponseDto[]): string {
  const escape = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const headers = LEAD_EXPORT_COLUMNS.map((c) => c.header);
  const headerCells = headers.map((h) => `<Cell><Data ss:Type="String">${escape(h)}</Data></Cell>`).join('');

  const rowsXml = leads
    .map((lead) => {
      const cells = LEAD_EXPORT_COLUMNS.map((c) => {
        const v = c.get(lead);
        const isNumeric = typeof v === 'number';
        return `<Cell><Data ss:Type="${isNumeric ? 'Number' : 'String'}">${escape(v ?? '')}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    })
    .join('\n');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Leads">
  <Table>
   <Row>${headerCells}</Row>
${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function exportLeadsAsXls(leads: LeadResponseDto[]): Blob {
  const xml = buildXmlss(leads);
  return new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
}