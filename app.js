const state = {
  docs: [],
  chunks: [],
  compliance: [],
  analytics: null,
  preliminary: null,
  intelligence: [],
  intelligenceLastUpdated: null,
};

const refs = {
  fileInput: document.getElementById('fileInput'),
  statusText: document.getElementById('statusText'),
  metrics: document.getElementById('metrics'),
  docBody: document.querySelector('#docTable tbody'),
  complianceResults: document.getElementById('complianceResults'),
  analyticsResults: document.getElementById('analyticsResults'),
  prelimResults: document.getElementById('prelimResults'),
  intelResults: document.getElementById('intelResults'),
  chatInput: document.getElementById('chatInput'),
  chatLog: document.getElementById('chatLog'),
};

const complianceRules = [
  { id: 'INDAS_REVENUE', label: 'Ind AS revenue recognition disclosure', keywords: ['revenue recognition', 'performance obligation', 'contract liability'] },
  { id: 'SCHEDULEIII_BALANCE', label: 'Schedule III balance sheet presentation', keywords: ['balance sheet', 'current liabilities', 'non-current assets'] },
  { id: 'SEBI_RELATED_PARTY', label: 'SEBI related-party and governance disclosure', keywords: ['related party', 'board meeting', 'independent director'] },
  { id: 'RBI_RISK', label: 'RBI financial institution risk disclosure', keywords: ['capital adequacy', 'npas', 'liquidity coverage'] },
  { id: 'BRSR_CORE', label: 'SEBI BRSR core ESG metrics', keywords: ['greenhouse gas', 'scope 1', 'scope 2', 'esg'] },
  { id: 'AUDIT_STD', label: 'Auditing standards evidence trail', keywords: ['audit opinion', 'material misstatement', 'internal control'] },
];

const intelligenceFeeds = [
  { source: 'RBI Press Releases', url: 'https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx' },
  { source: 'SEBI Media Releases', url: 'https://www.sebi.gov.in/media/media-releases.html' },
  { source: 'Ministry of Corporate Affairs', url: 'https://www.mca.gov.in/content/mca/global/en/notifications-tender/news-and-updates.html' },
  { source: 'Economic Times Financial Regulation', url: 'https://economictimes.indiatimes.com/topic/financial-regulation/rss.cms' },
];

const setStatus = (text) => {
  refs.statusText.textContent = text;
};

const escapeHtml = (v) => String(v)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const chunkText = (text, size = 420) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const result = [];
  for (let i = 0; i < normalized.length; i += size) {
    result.push(normalized.slice(i, i + size));
  }
  return result;
};


let pdfjsLibPromise;

async function getPdfJsLib() {
  if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
  if (window.pdfjsLib) return window.pdfjsLib;
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs')
      .then((mod) => mod && mod.GlobalWorkerOptions ? mod : null)
      .catch(() => null);
  }
  return pdfjsLibPromise;
}

async function extractPdfText(file) {
  const pdfjsLib = await getPdfJsLib();
  if (!pdfjsLib) return { text: '', pages: 0 };

  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs';
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p += 1) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return { text: pages.join('\n'), pages: pdf.numPages };
}

async function extractImageText(file) {
  if (!globalThis.Tesseract) return { text: '', pages: 0 };
  const result = await Tesseract.recognize(file, 'eng', { logger: () => {} });
  return { text: result.data.text, pages: 1 };
}

function estimateQuality(text) {
  if (!text.trim()) return 0;
  const alphaNum = (text.match(/[A-Za-z0-9]/g) || []).length;
  const noisy = (text.match(/[^A-Za-z0-9\s\.,;:%\-()]/g) || []).length;
  return Math.max(0, Math.min(100, Math.round((alphaNum / (alphaNum + noisy + 1)) * 100)));
}

function detectTableSignals(text) {
  const lines = text.split('\n');
  const candidates = lines.filter((ln) => (ln.match(/,/g) || []).length >= 3 || /\|/.test(ln) || /\b\d{1,3}(,\d{3})*(\.\d+)?\b/.test(ln));
  return candidates.length;
}

async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (['txt', 'csv', 'json'].includes(ext)) {
    const text = await file.text();
    const units = ext === 'csv' ? text.trim().split('\n').length : 1;
    return { text, units };
  }
  if (ext === 'pdf') {
    const { text, pages } = await extractPdfText(file);
    return { text, units: pages };
  }
  if (['png', 'jpg', 'jpeg'].includes(ext)) {
    return extractImageText(file);
  }
  return { text: '', units: 0 };
}

function renderMetrics() {
  const findingsOpen = state.compliance.filter((item) => item.status !== 'Compliant').length;
  refs.metrics.innerHTML = [
    ['Documents', state.docs.length],
    ['Indexed Chunks', state.chunks.length],
    ['Open Findings', findingsOpen],
    ['Live Feeds', state.intelligence.length],
  ].map(([k, v]) => `<div class="metric"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
}

function renderDocs() {
  refs.docBody.innerHTML = state.docs.map((doc) => `
    <tr>
      <td>${escapeHtml(doc.name)}</td>
      <td>${escapeHtml(doc.mime)}</td>
      <td>${doc.units}</td>
      <td><span class="badge ${doc.quality >= 80 ? 'good' : doc.quality >= 55 ? 'warn' : 'bad'}">${doc.quality}%</span></td>
      <td>${doc.extracted ? '<span class="badge good">Extracted</span>' : '<span class="badge warn">Pending</span>'}</td>
    </tr>
  `).join('');
  renderMetrics();
}

function runCompliance() {
  if (!state.docs.length) {
    setStatus('Load and process documents before compliance validation.');
    return;
  }
  state.compliance = complianceRules.map((rule) => {
    const matches = state.docs.filter((doc) => rule.keywords.some((kw) => doc.text.toLowerCase().includes(kw))).length;
    const ratio = matches / Math.max(state.docs.length, 1);
    const status = ratio > 0.65 ? 'Compliant' : ratio > 0.3 ? 'Partial' : 'Non-Compliant';
    const severity = status === 'Compliant' ? 'good' : status === 'Partial' ? 'warn' : 'bad';
    return {
      ...rule,
      matches,
      status,
      severity,
      explanation: status === 'Compliant'
        ? `Evidence found in ${matches}/${state.docs.length} files.`
        : `Insufficient evidence. Add explicit disclosure language for ${rule.label}.`,
    };
  });

  refs.complianceResults.innerHTML = state.compliance.map((finding) => `
    <div class="item">
      <strong>${finding.label}</strong><br>
      <span class="badge ${finding.severity}">${finding.status}</span>
      <span class="hint">Matched files: ${finding.matches}</span>
      <div>${finding.explanation}</div>
    </div>
  `).join('');

  setStatus(`Compliance validation completed with ${state.compliance.length} rule decisions.`);
  renderMetrics();
}

function runAnalytics() {
  if (!state.docs.length) {
    setStatus('Process documents first to generate analytics.');
    return;
  }

  const corpus = state.docs.map((doc) => doc.text).join('\n').toLowerCase();
  const allWords = corpus.match(/[a-z]{4,}/g) || [];
  const frequency = {};
  allWords.forEach((word) => { frequency[word] = (frequency[word] || 0) + 1; });
  const topTerms = Object.entries(frequency).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const riskIndicators = ['fraud', 'penalty', 'investigation', 'restatement', 'qualification', 'default'];
  const riskCounts = riskIndicators.map((key) => ({ key, count: (corpus.match(new RegExp(`\\b${key}\\b`, 'g')) || []).length }));

  state.analytics = {
    totalDocuments: state.docs.length,
    totalTokens: allWords.length,
    topTerms,
    riskCounts,
  };

  refs.analyticsResults.innerHTML = `
    <div class="item"><strong>Corpus Size</strong>: ${state.analytics.totalDocuments} docs, ${state.analytics.totalTokens.toLocaleString()} tokens</div>
    <div class="item"><strong>Top Terms</strong>: ${topTerms.map(([word, c]) => `${word} (${c})`).join(', ') || 'n/a'}</div>
    <div class="item"><strong>Risk Indicators</strong>: ${riskCounts.map(({ key, count }) => `${key}: ${count}`).join(' | ')}</div>
  `;

  setStatus('Automated analytics generated from extracted content.');
}

function scoreIntelligenceRisk(item) {
  const text = `${item.title} ${item.description || ''}`.toLowerCase();
  let score = 0;
  ['penalty', 'enforcement', 'violation', 'fraud', 'whistleblower', 'investigation', 'order', 'non-compliance'].forEach((k) => {
    if (text.includes(k)) score += 1;
  });
  return score;
}

async function fetchFeed(source) {
  const isRss = source.url.endsWith('.xml') || source.url.includes('/rss');
  const endpoint = isRss
    ? `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}`
    : `https://r.jina.ai/http://${source.url.replace(/^https?:\/\//, '')}`;

  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Feed fetch failed: ${source.source}`);

  if (isRss) {
    const payload = await res.json();
    return (payload.items || []).slice(0, 5).map((it) => ({
      source: source.source,
      title: it.title || 'Untitled',
      link: it.link || source.url,
      pubDate: it.pubDate || '',
      description: it.description ? it.description.replace(/<[^>]*>/g, '').slice(0, 220) : '',
    }));
  }

  const text = await res.text();
  const rows = text.split('\n').filter((ln) => ln.trim().length > 30).slice(0, 5);
  return rows.map((row) => ({
    source: source.source,
    title: row.trim().slice(0, 130),
    link: source.url,
    pubDate: new Date().toISOString(),
    description: row.trim().slice(0, 220),
  }));
}

async function refreshIntelligence() {
  setStatus('Refreshing real-time regulatory and enforcement intelligence feeds...');
  const allItems = [];
  for (const source of intelligenceFeeds) {
    try {
      const items = await fetchFeed(source);
      allItems.push(...items);
    } catch (err) {
      allItems.push({
        source: source.source,
        title: `Feed unavailable: ${source.source}`,
        link: source.url,
        pubDate: '',
        description: 'Unable to fetch live updates from this source in current environment.',
      });
    }
  }

  state.intelligence = allItems
    .map((item) => ({ ...item, risk: scoreIntelligenceRisk(item) }))
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 18);
  state.intelligenceLastUpdated = new Date().toISOString();

  refs.intelResults.innerHTML = state.intelligence.map((item) => `
    <div class="item">
      <span class="badge ${item.risk >= 2 ? 'bad' : item.risk === 1 ? 'warn' : 'good'}">Risk ${item.risk}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <div class="hint">${escapeHtml(item.source)} • ${escapeHtml(item.pubDate || 'Unknown date')}</div>
      <div>${escapeHtml(item.description || 'No description')}</div>
      <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">Open source</a>
    </div>
  `).join('');

  renderMetrics();
  setStatus(`Live intelligence refreshed (${state.intelligence.length} updates).`);
}

function runPreliminaryExam() {
  if (!state.docs.length) {
    setStatus('Process documents first before examination.');
    return;
  }

  const corpus = state.docs.map((doc) => doc.text).join(' ').toLowerCase();
  const weakControls = ['manual override', 'related party', 'exception approval', 'qualified opinion']
    .filter((term) => corpus.includes(term));

  const highRiskNews = state.intelligence.filter((item) => item.risk >= 2).slice(0, 5);
  const unresolvedCompliance = state.compliance.filter((c) => c.status !== 'Compliant').length;

  state.preliminary = {
    unresolvedCompliance,
    weakControls,
    highRiskNews,
    recommendation: unresolvedCompliance > 2 || highRiskNews.length > 1
      ? 'Escalate for deep-dive forensic review with legal and supervisory teams.'
      : 'Continue standard review workflow with periodic monitoring.',
  };

  refs.prelimResults.innerHTML = `
    <div class="item"><strong>Unresolved Compliance Findings:</strong> ${unresolvedCompliance}</div>
    <div class="item"><strong>Potential Internal Control Signals:</strong> ${weakControls.join(', ') || 'None detected'}</div>
    <div class="item"><strong>High-Risk Live Intelligence:</strong> ${highRiskNews.map((x) => escapeHtml(x.title)).join(' | ') || 'None'}</div>
    <div class="item"><strong>Recommendation:</strong> ${state.preliminary.recommendation}</div>
  `;

  setStatus('Preliminary examination completed using document + real-time intelligence context.');
}

function askBot() {
  const query = refs.chatInput.value.trim();
  if (!query) return;

  const q = query.toLowerCase();
  const docHit = state.chunks.find((chunk) => q.split(' ').some((w) => w.length > 3 && chunk.toLowerCase().includes(w)));
  const compHit = state.compliance.find((c) => q.includes(c.id.toLowerCase().split('_')[0]) || q.includes(c.label.toLowerCase().split(' ')[0]));
  const newsHit = state.intelligence.find((item) => q.split(' ').some((w) => w.length > 4 && item.title.toLowerCase().includes(w)));

  const parts = [];
  if (compHit) parts.push(`Compliance status: ${compHit.label} is ${compHit.status}. ${compHit.explanation}`);
  if (newsHit) parts.push(`Live update: ${newsHit.title} (${newsHit.source}).`);
  if (docHit) parts.push(`Evidence excerpt: "${docHit.slice(0, 220)}..."`);
  if (!parts.length) parts.push('No direct match found. Try including framework, entity, or disclosure keywords.');

  refs.chatLog.innerHTML += `
    <div class="chat-item"><strong>User</strong>${escapeHtml(query)}</div>
    <div class="chat-item"><strong>NFRA Insight Bot</strong>${escapeHtml(parts.join(' '))}</div>
  `;
  refs.chatInput.value = '';
}

function exportReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    intelligenceLastUpdated: state.intelligenceLastUpdated,
    summary: {
      documents: state.docs.length,
      chunks: state.chunks.length,
      unresolvedFindings: state.compliance.filter((item) => item.status !== 'Compliant').length,
    },
    documents: state.docs.map((d) => ({
      name: d.name,
      mime: d.mime,
      size: d.size,
      units: d.units,
      quality: d.quality,
      extracted: d.extracted,
    })),
    compliance: state.compliance,
    analytics: state.analytics,
    preliminary: state.preliminary,
    intelligence: state.intelligence,
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compliance-case-report-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function processDocuments() {
  const files = Array.from(refs.fileInput.files || []);
  if (!files.length) {
    setStatus('No files selected. Add documents for extraction.');
    return;
  }

  setStatus(`Processing ${files.length} documents with OCR/PDF/structured extractors...`);
  state.docs = files.map((file) => ({
    name: file.name,
    mime: file.type || 'unknown',
    size: file.size,
    units: 0,
    quality: 0,
    extracted: false,
    text: '',
  }));
  renderDocs();

  let extractedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < files.length; i += 1) {
    try {
      const { text, units } = await parseFile(files[i]);
      state.docs[i].text = text || '';
      state.docs[i].units = units || 0;
      state.docs[i].quality = estimateQuality(state.docs[i].text);
      state.docs[i].tableSignals = detectTableSignals(state.docs[i].text);
      state.docs[i].extracted = true;
      extractedCount += 1;
      setStatus(`Extracted ${i + 1}/${files.length}: ${files[i].name}`);
    } catch (error) {
      failedCount += 1;
      state.docs[i].text = '';
      state.docs[i].units = 0;
      state.docs[i].quality = 0;
      state.docs[i].tableSignals = 0;
      state.docs[i].extracted = false;
      setStatus(`Failed extraction for ${files[i].name}. Continuing with remaining files.`);
      console.error('Document extraction failed', files[i].name, error);
    }
    renderDocs();
  }

  state.chunks = state.docs
    .filter((doc) => doc.extracted && doc.text.trim().length)
    .flatMap((doc) => chunkText(doc.text).map((chunk) => `${doc.name}: ${chunk}`));

  if (failedCount) {
    setStatus(`Extraction completed with warnings. Success: ${extractedCount}, Failed: ${failedCount}, Indexed chunks: ${state.chunks.length}.`);
  } else {
    setStatus(`Extraction complete. ${state.docs.length} documents indexed into ${state.chunks.length} chunks.`);
  }
  renderDocs();
}

document.getElementById('btnProcess').addEventListener('click', processDocuments);
document.getElementById('btnCompliance').addEventListener('click', runCompliance);
document.getElementById('btnAnalytics').addEventListener('click', runAnalytics);
document.getElementById('btnPrelim').addEventListener('click', runPreliminaryExam);
document.getElementById('btnRefreshIntel').addEventListener('click', refreshIntelligence);
document.getElementById('btnAsk').addEventListener('click', askBot);
document.getElementById('btnExport').addEventListener('click', exportReport);

refreshIntelligence();
setInterval(refreshIntelligence, 15 * 60 * 1000);
renderMetrics();
