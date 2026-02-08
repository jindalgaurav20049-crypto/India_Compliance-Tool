const state = {
  docs: [],
  chunks: [],
  compliance: [],
  analytics: null,
  prelim: null,
};

const refs = {
  fileInput: document.getElementById('fileInput'),
  statusText: document.getElementById('statusText'),
  docBody: document.querySelector('#docTable tbody'),
  complianceResults: document.getElementById('complianceResults'),
  analyticsResults: document.getElementById('analyticsResults'),
  prelimResults: document.getElementById('prelimResults'),
  chatInput: document.getElementById('chatInput'),
  chatLog: document.getElementById('chatLog'),
};

const setStatus = (msg) => refs.statusText.textContent = msg;

const formatBytes = (bytes) => {
  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let idx = 0;
  while (value > 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(1)} ${units[idx]}`;
};

const chunkText = (text, size = 450) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chunks = [];
  for (let i = 0; i < clean.length; i += size) chunks.push(clean.slice(i, i + size));
  return chunks;
};

async function extractPdfText(file) {
  const pdfjsLib = globalThis.pdfjsLib || window['pdfjs-dist/build/pdf'];
  if (!pdfjsLib) return '';
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n');
}

async function extractImageText(file) {
  const result = await Tesseract.recognize(file, 'eng', { logger: () => {} });
  return result.data.text;
}

async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (['txt', 'csv', 'json'].includes(ext)) {
    return await file.text();
  }
  if (ext === 'pdf') return await extractPdfText(file);
  if (['png', 'jpg', 'jpeg'].includes(ext)) return await extractImageText(file);
  return '';
}

function renderDocs() {
  refs.docBody.innerHTML = '';
  for (const doc of state.docs) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${doc.name}</td><td>${doc.type}</td><td>${formatBytes(doc.size)}</td><td>${doc.extracted ? 'Complete' : 'Pending'}</td>`;
    refs.docBody.appendChild(row);
  }
}

const ruleBook = [
  { key: 'balance sheet', rule: 'Schedule III: Balance Sheet should be present', severity: 'high' },
  { key: 'cash flow', rule: 'Ind AS 7: Cash Flow Statement should be disclosed', severity: 'high' },
  { key: 'related party', rule: 'Ind AS 24: Related party disclosures required', severity: 'medium' },
  { key: 'esg', rule: 'SEBI ESG/BRSR Core indicators required for listed entities', severity: 'medium' },
  { key: 'risk management', rule: 'RBI/SEBI risk governance narrative expected', severity: 'low' },
];

function runCompliance() {
  const corpus = state.docs.map(d => d.text.toLowerCase()).join('\n');
  state.compliance = ruleBook.map(r => ({
    ...r,
    status: corpus.includes(r.key) ? 'Compliant' : 'Needs Review',
  }));

  refs.complianceResults.innerHTML = state.compliance.map(item => {
    const cls = item.status === 'Compliant' ? 'ok' : item.severity === 'high' ? 'bad' : 'warn';
    return `<p><span class="tag ${cls}">${item.status}</span> ${item.rule}</p>`;
  }).join('');
}

function runAnalytics() {
  const text = state.docs.map(d => d.text).join(' ');
  const tokens = text.split(/\s+/).filter(Boolean);
  const numericTokens = tokens.map(t => Number(t.replace(/[,₹$]/g, ''))).filter(v => Number.isFinite(v));
  const sum = numericTokens.reduce((a, b) => a + b, 0);

  state.analytics = {
    documents: state.docs.length,
    chunksIndexed: state.chunks.length,
    wordCount: tokens.length,
    numericMentions: numericTokens.length,
    numericAggregate: sum,
  };

  refs.analyticsResults.innerHTML = `
    <ul>
      <li>Documents processed: <strong>${state.analytics.documents}</strong></li>
      <li>Indexed chunks: <strong>${state.analytics.chunksIndexed}</strong></li>
      <li>Total words extracted: <strong>${state.analytics.wordCount}</strong></li>
      <li>Numeric values identified: <strong>${state.analytics.numericMentions}</strong></li>
      <li>Aggregate numeric signal: <strong>${state.analytics.numericAggregate.toLocaleString()}</strong></li>
    </ul>`;
}

function runPreliminaryExam() {
  const flags = [];
  const corpus = state.docs.map(d => d.text.toLowerCase()).join(' ');
  if (corpus.includes('fraud') || corpus.includes('whistle')) flags.push('Potential whistle-blower / fraud signal detected.');
  if (corpus.includes('penalty') || corpus.includes('enforcement')) flags.push('Possible regulatory enforcement linkage identified.');
  if (corpus.includes('litigation') || corpus.includes('court')) flags.push('Legal proceedings references detected.');
  if (!flags.length) flags.push('No immediate red flags found in submitted corpus.');

  state.prelim = flags;
  refs.prelimResults.innerHTML = `<ul>${flags.map(f => `<li>${f}</li>`).join('')}</ul>`;
}

function askBot() {
  const q = refs.chatInput.value.trim();
  if (!q) return;
  const pool = state.chunks.filter(c => c.toLowerCase().includes(q.toLowerCase().split(' ')[0]));
  const answer = pool.slice(0, 2).join(' ... ') || 'No direct chunk match found. Try a narrower regulatory phrase (e.g., "cash flow", "related party", "BRSR").';

  const ask = document.createElement('div');
  ask.className = 'chat-item';
  ask.innerHTML = `<strong>User</strong>${q}`;
  const res = document.createElement('div');
  res.className = 'chat-item';
  res.innerHTML = `<strong>NFRA Insight Bot</strong>${answer}`;
  refs.chatLog.append(ask, res);
  refs.chatInput.value = '';
}

function exportReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      documents: state.docs.length,
      chunksIndexed: state.chunks.length,
    },
    compliance: state.compliance,
    analytics: state.analytics,
    preliminary: state.prelim,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'compliance-validation-report.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function processDocuments() {
  const files = Array.from(refs.fileInput.files || []);
  if (!files.length) {
    setStatus('No files selected. Upload one or more financial documents.');
    return;
  }

  setStatus('Running extraction engine across uploaded documents...');
  state.docs = files.map(file => ({ name: file.name, size: file.size, type: file.type || 'unknown', extracted: false, text: '' }));
  renderDocs();

  for (let i = 0; i < files.length; i += 1) {
    const text = await parseFile(files[i]);
    state.docs[i].text = text;
    state.docs[i].extracted = true;
  }

  state.chunks = state.docs.flatMap(doc => chunkText(doc.text));
  renderDocs();
  setStatus(`Extraction complete. ${state.docs.length} documents processed and ${state.chunks.length} chunks indexed.`);
}

document.getElementById('btnProcess').addEventListener('click', processDocuments);
document.getElementById('btnCompliance').addEventListener('click', runCompliance);
document.getElementById('btnAnalytics').addEventListener('click', runAnalytics);
document.getElementById('btnPrelim').addEventListener('click', runPreliminaryExam);
document.getElementById('btnAsk').addEventListener('click', askBot);
document.getElementById('btnExport').addEventListener('click', exportReport);
