import { createRoute, z } from "@hono/zod-openapi";

const VALIDATION_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Validação de Ruas — Traffic Violations</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.5; }
.container { max-width: 900px; margin: 0 auto; padding: 24px; }
h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 8px; color: #f8fafc; }
.stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.stat-card { background: #1e293b; border-radius: 8px; padding: 16px; min-width: 140px; flex: 1; }
.stat-card .label { font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
.stat-card .value { font-size: 1.5rem; font-weight: 700; color: #f8fafc; margin-top: 4px; }
.card { background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #334155; }
.card.pending { border-color: #f59e0b; }
.card.matched { border-color: #10b981; }
.card.no-match { border-color: #ef4444; }
.original { font-size: 0.85rem; color: #94a3b8; margin-bottom: 12px; padding: 8px 12px; background: #0f172a; border-radius: 6px; word-break: break-all; }
.extracted { font-size: 1.15rem; font-weight: 600; margin-bottom: 4px; }
.meta { font-size: 0.8rem; color: #64748b; margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap; }
.meta span { display: inline-flex; align-items: center; gap: 4px; }
.candidates { margin-bottom: 16px; }
.candidate { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #0f172a; border-radius: 8px; margin-bottom: 8px; border: 1px solid transparent; cursor: pointer; transition: border-color 0.15s; }
.candidate:hover { border-color: #3b82f6; }
.candidate.selected { border-color: #10b981; background: #022c22; }
.candidate input[type="radio"] { accent-color: #3b82f6; width: 18px; height: 18px; }
.candidate .c-name { flex: 1; font-size: 0.95rem; }
.candidate .c-code { font-size: 0.75rem; color: #64748b; }
.candidate .c-score { font-size: 0.75rem; color: #10b981; font-weight: 600; }
.search-box { display: flex; gap: 8px; margin-bottom: 12px; }
.search-box input { flex: 1; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 0.95rem; outline: none; }
.search-box input:focus { border-color: #3b82f6; }
.search-box button { padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
.search-box button:hover { background: #2563eb; }
.search-results { max-height: 200px; overflow-y: auto; margin-bottom: 12px; }
.actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
.btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer; border: none; transition: background 0.15s; }
.btn-confirm { background: #10b981; color: white; }
.btn-confirm:hover { background: #059669; }
.btn-confirm:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
.btn-skip { background: #334155; color: #e2e8f0; }
.btn-skip:hover { background: #475569; }
.btn-reject { background: #ef4444; color: white; }
.btn-reject:hover { background: #dc2626; }
.flash { padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem; display: none; }
.flash.success { display: block; background: #022c22; color: #10b981; border: 1px solid #10b981; }
.flash.error { display: block; background: #2c0202; color: #ef4444; border: 1px solid #ef4444; }
.empty { text-align: center; padding: 48px 24px; color: #64748b; }
.empty .icon { font-size: 3rem; margin-bottom: 12px; }
.pagination { display: flex; gap: 8px; justify-content: center; margin-top: 24px; }
.pagination button { padding: 8px 16px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; cursor: pointer; }
.pagination button:hover { background: #334155; }
.pagination button.active { background: #3b82f6; border-color: #3b82f6; }
.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
.loading { text-align: center; padding: 24px; color: #64748b; }
</style>
</head>
<body>
<div class="container">
  <h1>🔍 Validação de Ruas</h1>
  <p style="color:#64748b;margin-bottom:20px">Revise e confirme os matches de baixa confiança</p>

  <div class="stats" id="stats"></div>
  <div id="flash"></div>
  <div id="content"><div class="loading">Carregando...</div></div>
  <div class="pagination" id="pagination"></div>
</div>

<script>
const API = '/v1';

let currentPage = 1;
let stats = {};

async function fetchStats() {
  const r = await fetch(API + '/streets/match/stats');
  stats = await r.json();
  document.getElementById('stats').innerHTML =
    '<div class="stat-card"><div class="label">Total matched</div><div class="value">' + stats.total_locations_matched + '</div></div>' +
    '<div class="stat-card"><div class="label">Pendentes</div><div class="value" style="color:#f59e0b">' + stats.validation_queue.pending + '</div></div>' +
    '<div class="stat-card"><div class="label">Confirmados</div><div class="value" style="color:#10b981">' + stats.validation_queue.confirmed + '</div></div>' +
    '<div class="stat-card"><div class="label">Rejeitados</div><div class="value" style="color:#ef4444">' + stats.validation_queue.rejected + '</div></div>';
}

async function fetchPending(page) {
  const r = await fetch(API + '/streets/validations/pending?page=' + page + '&limit=10');
  return r.json();
}

function flash(msg, type) {
  const el = document.getElementById('flash');
  el.className = 'flash ' + type;
  el.textContent = msg;
  setTimeout(() => el.className = 'flash', 3000);
}

async function searchStreets(query) {
  const r = await fetch(API + '/streets?search=' + encodeURIComponent(query) + '&limit=10');
  const data = await r.json();
  return data.data || [];
}

async function confirmMatch(id) {
  const r = await fetch(API + '/streets/validations/' + id + '/confirm', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({validated_by: 'human'})
  });
  if (r.ok) { flash('✓ Confirmado!', 'success'); render(); } else { flash('Erro ao confirmar', 'error'); }
}

async function rejectMatch(id, correctedCode) {
  const body = {validated_by: 'human'};
  if (correctedCode) body.corrected_street_code = correctedCode;
  const r = await fetch(API + '/streets/validations/' + id + '/reject', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  if (r.ok) { flash('✗ Rejeitado', 'success'); render(); } else { flash('Erro ao rejeitar', 'error'); }
}

function buildCard(m) {
  const candidates = Array.isArray(m.candidates) ? m.candidates : [];
  const normalized = m.normalized || {};
  const conf = m.match_confidence != null ? (Number(m.match_confidence)*100).toFixed(0) + '%' : '-';

  let html = '<div class="card pending">';
  html += '<div class="original">📍 <strong>Original:</strong> ' + esc(m.location_description) + '</div>';
  html += '<div class="extracted">🔎 ' + esc(m.extracted_street_name || '(não extraída)') + '</div>';
  html += '<div class="meta">';
  html += '<span>🏷 Método: ' + esc(m.match_method || '-') + '</span>';
  html += '<span>📊 Confiança: ' + conf + '</span>';
  html += '<span>📍 Location ID: ' + m.location_id + '</span>';
  html += '<span>🔢 Match ID: ' + m.id + '</span>';
  html += '</div>';

  if (candidates.length > 0) {
    html += '<div class="candidates"><strong>Sugestões:</strong>';
    candidates.forEach((c, i) => {
      html += '<label class="candidate" onclick="selectCandidate(' + m.id + ',' + c.street_code + ')">';
      html += '<input type="radio" name="cand_' + m.id + '" value="' + c.street_code + '" ' + (i===0?'checked':'') + '>';
      html += '<span class="c-name">' + esc(c.official_name) + '</span>';
      html += '<span class="c-score">' + (c.score*100).toFixed(0) + '%</span>';
      html += '<span class="c-code">cód. ' + c.street_code + '</span>';
      html += '</label>';
    });
    html += '</div>';
  }

  html += '<div class="search-box">';
  html += '<input type="text" id="search_' + m.id + '" placeholder="Buscar no PCR...">';
  html += '<button onclick="doSearch(' + m.id + ')">🔎</button>';
  html += '</div>';
  html += '<div class="search-results" id="results_' + m.id + '"></div>';

  html += '<div class="actions">';
  html += '<button class="btn btn-confirm" onclick="doConfirm(' + m.id + ')">✓ Confirmar selecionado</button>';
  html += '<button class="btn btn-reject" onclick="doReject(' + m.id + ')">✗ Rejeitar (sem match)</button>';
  html += '</div>';

  html += '</div>';
  return html;
}

let selectedCodes = {};

function selectCandidate(matchId, code) {
  selectedCodes[matchId] = code;
}

async function doSearch(matchId) {
  const q = document.getElementById('search_' + matchId).value;
  if (!q || q.length < 2) return;
  const results = await searchStreets(q);
  const container = document.getElementById('results_' + matchId);
  if (results.length === 0) {
    container.innerHTML = '<div style="color:#64748b;font-size:0.85rem;padding:8px">Nenhum resultado</div>';
    return;
  }
  container.innerHTML = results.map(s =>
    '<label class="candidate" style="cursor:pointer" onclick="selectCandidate(' + matchId + ',' + s.code + ')">' +
    '<input type="radio" name="cand_' + matchId + '" value="' + s.code + '">' +
    '<span class="c-name">' + esc(s.official_name) + '</span>' +
    '<span class="c-code">cód. ' + s.code + ' | ' + esc(s.neighborhood_name || '') + '</span>' +
    '</label>'
  ).join('');
}

async function doConfirm(matchId) {
  const code = selectedCodes[matchId] || document.querySelector('input[name="cand_' + matchId + '"]:checked')?.value;
  if (!code) {
    const r = await fetch(API + '/streets/validations/' + matchId + '/confirm', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({validated_by: 'human'})
    });
    if (r.ok) { flash('✓ Confirmado!', 'success'); render(); } else { flash('Erro', 'error'); }
  } else {
    const r = await fetch(API + '/streets/validations/' + matchId + '/confirm', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({validated_by: 'human'})
    });
    if (r.ok) { flash('✓ Confirmado!', 'success'); render(); } else { flash('Erro', 'error'); }
  }
}

async function doReject(matchId) {
  if (!confirm('Tem certeza que deseja rejeitar este match?')) return;
  await rejectMatch(matchId, null);
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function render() {
  await fetchStats();
  const data = await fetchPending(currentPage);
  const content = document.getElementById('content');
  const pagination = document.getElementById('pagination');
  selectedCodes = {};

  if (!data.data || data.data.length === 0) {
    content.innerHTML = '<div class="empty"><div class="icon">✅</div><strong>Nada pendente!</strong><br>Todos os matches foram revisados.</div>';
    pagination.innerHTML = '';
    return;
  }

  content.innerHTML = data.data.map(buildCard).join('');

  const totalPages = data.pagination.totalPages || 1;
  let pagHtml = '';
  pagHtml += '<button onclick="goPage(' + (currentPage-1) + ')" ' + (currentPage<=1?'disabled':'') + '>← Anterior</button>';
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 10 && p > 2 && p < totalPages - 1 && Math.abs(p - currentPage) > 2) {
      if (p === 3) pagHtml += '<button disabled>...</button>';
      continue;
    }
    pagHtml += '<button class="' + (p===currentPage?'active':'') + '" onclick="goPage(' + p + ')">' + p + '</button>';
  }
  pagHtml += '<button onclick="goPage(' + (currentPage+1) + ')" ' + (currentPage>=totalPages?'disabled':'') + '>Próximo →</button>';
  pagination.innerHTML = pagHtml;
}

function goPage(p) {
  currentPage = Math.max(1, p);
  render();
  window.scrollTo(0, 0);
}

render();
</script>
</body>
</html>`;

export const validationPageRoute = createRoute({
  method: "get",
  path: "/validations",
  tags: ["Validation"],
  summary: "Human validation interface",
  description: "Interactive HTML page for reviewing and confirming low-confidence street matches.",
  responses: {
    200: {
      content: {
        "text/html": { schema: z.string() },
      },
      description: "Validation HTML page",
    },
  },
});

export { VALIDATION_HTML };
