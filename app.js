// Scopoli (a Koetai product) — a Rosalind-style SPARQL problem site. Plain JS, hash routing,
// progress kept in localStorage, answers checked against live endpoints.

const BY_ID = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
const STORE = "koetai.scopoli.v1";
const view = document.getElementById("view");
let editor = null;

// ------------------------------------------------------------------ storage
function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || { solved: {}, drafts: {} }; }
  catch { return { solved: {}, drafts: {} }; }
}
function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
}
let state = load();
const isSolved = (id) => !!state.solved[id];

// ------------------------------------------------------------------ helpers
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SHORT = [
  ["http://www.wikidata.org/entity/", "wd:"],
  ["http://purl.uniprot.org/uniprot/", "uniprot:"],
  ["http://purl.uniprot.org/core/", "up:"],
  ["http://purl.obolibrary.org/obo/", "obo:"],
  ["http://id.nlm.nih.gov/mesh/", "mesh:"],
  ["http://rdf.ebi.ac.uk/resource/chembl/molecule/", "chembl:"],
  ["http://rdf.rhea-db.org/", "rh:"],
  ["http://ncbi.nlm.nih.gov/clinvar/variation/", "clinvar:"],
];
function shorten(iri) {
  for (const [long, pre] of SHORT) if (iri.startsWith(long)) return pre + iri.slice(long.length);
  return iri;
}
const trackDot = (t) => `<span class="dot" style="background:${TRACKS[t].color}"></span>`;
const unsolvedPrereqs = (p) => p.prereqs.filter((id) => !isSolved(id));
const children = (id) => PROBLEMS.filter((p) => p.prereqs.includes(id));

function updateProgress() {
  const n = PROBLEMS.filter((p) => isSolved(p.id)).length;
  document.getElementById("progress").textContent = `${n} / ${PROBLEMS.length} solved`;
}

// --------------------------------------------------------------- SPARQL I/O
async function runQuery(endpointKey, query) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(ENDPOINTS[endpointKey].url, {
      method: "POST",
      headers: { Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(cleanError(text) || `HTTP ${res.status}`);
    let json;
    try { json = JSON.parse(text); } catch { throw new Error("The endpoint did not return SPARQL JSON results. Is this a SELECT query?"); }
    if (!json.head || !json.results) throw new Error("Only SELECT queries are supported here.");
    return { vars: json.head.vars, rows: json.results.bindings };
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The query timed out after 90 seconds.");
    if (e instanceof TypeError) throw new Error("Network error — the endpoint may be down or unreachable.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Endpoint error bodies are long Java stack traces; keep the useful line.
function cleanError(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const hit = lines.find((l) => /parse|Encountered|Lexical|syntax|MalformedQuery|Exception:|error/i.test(l) && l.length < 400);
  return (hit || lines.slice(0, 3).join(" ")).slice(0, 500);
}

const NUMERIC = /#(integer|decimal|double|float|int|long|short|nonNegativeInteger|positiveInteger)$/;
function norm(b) {
  if (!b) return "";
  if (b.type === "literal" && b.datatype && NUMERIC.test(b.datatype)) return String(Number(b.value));
  return b.value;
}
function keySet(result, cols) {
  return new Set(result.rows.map((r) => cols.map((c) => norm(r[c])).join(" │ ")));
}

const refCache = {};
async function reference(p) {
  if (!refCache[p.id]) refCache[p.id] = runQuery(p.endpoint, p.solution).catch((e) => { delete refCache[p.id]; throw e; });
  return refCache[p.id];
}

// ------------------------------------------------------------------- views
function home() {
  const counts = Object.keys(TRACKS).map((t) => {
    const ps = PROBLEMS.filter((p) => p.track === t);
    return { t, total: ps.length, done: ps.filter((p) => isSolved(p.id)).length, first: ps[0] };
  });
  const next = PROBLEMS.find((p) => !isSolved(p.id) && unsolvedPrereqs(p).length === 0);
  view.innerHTML = `
    <section class="hero">
      <h1>Learn SPARQL by solving biomedical problems</h1>
      <p>Each problem is a small research question — which genes are linked to Parkinson's, which enzymes touch cholesterol, which CFTR variants are pathogenic — answered with a live query against real knowledge graphs. Solve one to unlock the next.</p>
      <p>${next ? `<a class="btn primary" href="#/p/${next.id}">${isSolved("TRPL") ? "Continue" : "Start"} with ${next.id} · ${esc(next.title)} →</a>` : `<span class="btn primary">All problems solved 🎉</span>`}
      <a class="btn" href="#/tree">View the tree</a></p>
    </section>
    <div class="tracks">
      ${counts.map(({ t, total, done, first }) => `
        <div class="card">
          <h3>${trackDot(t)}${TRACKS[t].name}</h3>
          <div class="empty">${trackBlurb[t]}</div>
          <p style="margin:10px 0 0;font-size:13px">${done} / ${total} solved · starts at <a href="#/p/${first.id}">${first.id}</a></p>
        </div>`).join("")}
    </div>`;
}
const trackBlurb = {
  wd: "Core SPARQL — patterns, OPTIONAL, FILTER, aggregates, paths, UNION, NOT EXISTS, VALUES — on genes, drugs and diseases in Wikidata.",
  sib: "Curated protein knowledge in UniProt, federation with Rhea reactions, and bridging Wikidata to UniProt.",
  rp: "MeSH, ChEMBL and ClinVar on the DBCLS RDF Portal: named graphs, shared IRIs and deeply nested real-world RDF.",
};

let listFilter = "all";
function list() {
  const rows = PROBLEMS.filter((p) => listFilter === "all" || p.track === listFilter);
  view.innerHTML = `
    <h1>Problems</h1>
    <div class="filters">
      <button class="chip ${listFilter === "all" ? "on" : ""}" data-f="all">All</button>
      ${Object.entries(TRACKS).map(([k, t]) => `<button class="chip ${listFilter === k ? "on" : ""}" data-f="${k}">${trackDot(k)}${t.name}</button>`).join("")}
    </div>
    <div class="table-scroll"><table class="list">
      <thead><tr><th>ID</th><th>Title</th><th>Concept</th><th>Data</th><th>Status</th></tr></thead>
      <tbody>${rows.map((p) => `
        <tr>
          <td class="id">${trackDot(p.track)}<a href="#/p/${p.id}">${p.id}</a></td>
          <td><a href="#/p/${p.id}">${esc(p.title)}</a></td>
          <td class="concept">${esc(p.concept)}</td>
          <td class="concept">${esc(ENDPOINTS[p.endpoint].name.split(" (")[0].split(" · ").pop())}</td>
          <td>${isSolved(p.id) ? '<span class="solved">✓ solved</span>' : unsolvedPrereqs(p).length ? '<span class="empty">locked</span>' : "open"}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
  view.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { listFilter = b.dataset.f; list(); }));
}

function tree() {
  // Layer = longest path from a root, then order each layer by parents' position.
  const level = {};
  const depth = (id) => level[id] ?? (level[id] = Math.max(-1, ...BY_ID[id].prereqs.map(depth)) + 1);
  PROBLEMS.forEach((p) => depth(p.id));
  const layers = [];
  PROBLEMS.forEach((p) => (layers[level[p.id]] ||= []).push(p.id));
  const order = { wd: 0, sib: 1, rp: 2 };
  const xpos = {};
  layers.forEach((ids) => {
    const bary = (id) => { const ps = BY_ID[id].prereqs; return ps.length ? ps.reduce((s, q) => s + xpos[q], 0) / ps.length : 0; };
    ids.sort((a, b) => order[BY_ID[a].track] - order[BY_ID[b].track] || bary(a) - bary(b));
    ids.forEach((id, i) => (xpos[id] = i - (ids.length - 1) / 2));
  });
  const W = 118, H = 92, NW = 96, NH = 44;
  const maxW = Math.max(...layers.map((l) => l.length));
  const width = maxW * W + 40, height = layers.length * H + 30;
  const cx = (id) => width / 2 + xpos[id] * W;
  const cy = (id) => 30 + level[id] * H;
  let edges = "", nodes = "";
  PROBLEMS.forEach((p) => p.prereqs.forEach((q) => {
    const x1 = cx(q), y1 = cy(q) + NH / 2, x2 = cx(p.id), y2 = cy(p.id) - NH / 2, my = (y1 + y2) / 2;
    edges += `<path class="edge" d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"/>`;
  }));
  PROBLEMS.forEach((p) => {
    const c = TRACKS[p.track].color, s = isSolved(p.id);
    nodes += `<a href="#/p/${p.id}"><g class="node ${s ? "solved" : ""}" transform="translate(${cx(p.id) - NW / 2},${cy(p.id) - NH / 2})">
      <title>${esc(p.title)} — ${esc(p.concept)}</title>
      <rect width="${NW}" height="${NH}" rx="8" style="stroke:${c};${s ? `fill:${c}` : ""}"/>
      <text x="${NW / 2}" y="19" text-anchor="middle">${p.id}${s ? " ✓" : ""}</text>
      <text class="sub" x="${NW / 2}" y="34" text-anchor="middle">${esc(p.title.length > 17 ? p.title.slice(0, 16) + "…" : p.title)}</text>
    </g></a>`;
  });
  view.innerHTML = `
    <h1>Problem tree</h1>
    <p class="empty">Arrows point from a problem to the problems it unlocks. Filled boxes are solved.</p>
    <div class="tree-box"><svg viewBox="0 0 ${width} ${height}" width="${width}" role="img" aria-label="Problem dependency tree">${edges}${nodes}</svg></div>
    <div class="legend">${Object.entries(TRACKS).map(([k, t]) => `<span>${trackDot(k)}${t.name}</span>`).join("")}</div>`;
}

function about() {
  view.innerHTML = `<div class="about">
    <h1>About</h1>
    <p>Scopoli teaches SPARQL the way <a href="https://rosalind.info" target="_blank">Rosalind</a> teaches bioinformatics: through a tree of small, self-contained problems grounded in real biology. It is part of <a href="https://koetai.github.io/" target="_blank">Koetai</a>, open SPARQL tooling for the life sciences.</p>
    <h2>Why "Scopoli"?</h2>
    <p><i>Koetai</i> takes its name from the four-eyed fish <i>Anableps</i>, which swims at the surface of mangrove waters and sees above and below the waterline at once. The Tyrolean naturalist <a href="https://www.wikidata.org/wiki/Q84181" target="_blank">Giovanni Antonio Scopoli</a> (1723–1788) established the genus <a href="https://www.wikidata.org/wiki/Q1976257" target="_blank"><i>Anableps</i></a> in 1777. Like a good query, the fish looks at two worlds at the same time.</p>
    <h2>How checking works</h2>
    <p>When you press <b>Submit</b>, your query and a reference solution both run live against the same endpoint. Your answer is correct when the set of values in the checked columns matches. Column names matter (they're listed under <i>Return</i>); extra columns and row order don't. Because both run on today's data, answers stay valid as the knowledge graphs grow.</p>
    <h2>Endpoints</h2>
    <ul>${Object.values(ENDPOINTS).map((e) => `<li><b>${esc(e.name)}</b> — <code>${esc(e.url)}</code></li>`).join("")}</ul>
    <p>Your progress and drafts are stored only in this browser.</p>
    <p><button class="btn" id="reset">Reset my progress</button></p>
  </div>`;
  document.getElementById("reset").addEventListener("click", () => {
    if (confirm("Forget all solved problems and drafts?")) { state = { solved: {}, drafts: {} }; save(state); updateProgress(); about(); }
  });
}

function problem(id) {
  const p = BY_ID[id];
  if (!p) { view.innerHTML = `<p>No problem called ${esc(id)}. <a href="#/problems">Back to the list</a>.</p>`; return; }
  const ep = ENDPOINTS[p.endpoint];
  const missing = unsolvedPrereqs(p);
  view.innerHTML = `
    <div class="crumbs"><a href="#/problems">Problems</a> › ${trackDot(p.track)}${TRACKS[p.track].name}</div>
    <div class="ptitle"><span class="pid">${p.id}</span><h1>${esc(p.title)}</h1></div>
    <div class="meta">
      <span>Concept: <b>${esc(p.concept)}</b></span>
      ${p.prereqs.length ? `<span>After: ${p.prereqs.map((q) => `<a href="#/p/${q}">${q}</a>`).join(", ")}</span>` : ""}
      ${isSolved(p.id) ? '<span class="badge solved-badge">✓ solved</span>' : ""}
    </div>
    ${missing.length ? `<div class="note">Recommended first: ${missing.map((q) => `<a href="#/p/${q}">${q} · ${esc(BY_ID[q].title)}</a>`).join(", ")}. You can still try this one.</div>` : ""}
    <div class="cols">
      <div>
        <div class="section"><h2>Background</h2>${p.story}</div>
        <div class="section"><h2>The concept</h2>${p.lesson}</div>
        <div class="section"><h2>Problem</h2>
          <div class="task">${p.task}
            <div class="ret"><b>Return:</b> ${p.returns.map((v) => `<code>?${v}</code>`).join(" ")}
            ${p.check.length < p.returns.length ? ` · checked on ${p.check.map((v) => `<code>?${v}</code>`).join(" ")}` : ""}</div>
          </div>
          <details><summary>Sample output</summary><pre>${esc(p.sample)}</pre></details>
          <details><summary>Hint</summary><p>${p.hint}</p></details>
          <div id="reveal"></div>
        </div>
      </div>
      <div class="editor-pane">
        <div class="endpoint"><span>Endpoint: <b>${esc(ep.name)}</b></span><a href="#" id="open-ui" target="_blank">open in endpoint UI ↗</a></div>
        <textarea id="q"></textarea>
        <div class="actions">
          <button class="btn" id="run">▶ Run</button>
          <button class="btn primary" id="submit">Submit answer</button>
          <span class="spacer"></span>
          <span class="kbd">⌘/Ctrl + Enter to run</span>
          <button class="btn" id="reset-q" title="Restore the starter query">Reset</button>
        </div>
        <div id="verdict"></div>
        <div id="out"></div>
      </div>
    </div>`;

  editor = CodeMirror.fromTextArea(document.getElementById("q"), {
    mode: "application/sparql-query", lineNumbers: true, matchBrackets: true, indentUnit: 2, lineWrapping: true,
    extraKeys: { "Cmd-Enter": () => run(false), "Ctrl-Enter": () => run(false) },
  });
  editor.setValue(state.drafts[p.id] ?? p.starter);
  const lines = editor.getValue().split("\n");
  const blank = lines.findIndex((l, i) => i > 0 && /^\s*$/.test(l) && /\{\s*$/.test(lines[i - 1]));
  if (blank >= 0) {
    if (!lines[blank]) editor.replaceRange("  ", { line: blank, ch: 0 });
    editor.setCursor({ line: blank, ch: 2 });
    editor.clearHistory();
  }
  editor.on("change", () => { state.drafts[p.id] = editor.getValue(); save(state); });

  document.getElementById("open-ui").addEventListener("click", (e) => { e.currentTarget.href = ep.ui(editor.getValue()); });
  document.getElementById("run").addEventListener("click", () => run(false));
  document.getElementById("submit").addEventListener("click", () => run(true));
  document.getElementById("reset-q").addEventListener("click", () => {
    if (confirm("Replace your query with the starter template?")) { editor.setValue(p.starter); }
  });
  renderReveal(p);

  async function run(submit) {
    const runBtn = document.getElementById("run"), subBtn = document.getElementById("submit");
    const verdict = document.getElementById("verdict"), out = document.getElementById("out");
    runBtn.disabled = subBtn.disabled = true;
    verdict.innerHTML = `<div class="verdict info">${submit ? "Running your query and the reference solution…" : "Running…"}</div>`;
    const t0 = performance.now();
    try {
      const [mine, ref] = await Promise.all([runQuery(p.endpoint, editor.getValue()), submit ? reference(p) : null]);
      out.innerHTML = renderTable(mine, ((performance.now() - t0) / 1000).toFixed(1));
      verdict.innerHTML = submit ? judge(p, mine, ref) : "";
    } catch (e) {
      verdict.innerHTML = `<div class="verdict bad"><b>Query failed.</b> ${esc(e.message)}</div>`;
    } finally {
      runBtn.disabled = subBtn.disabled = false;
    }
  }
}

function renderTable(res, secs) {
  if (!res.rows.length) return `<div class="results"><div class="count">No results (${secs}s).</div></div>`;
  const shown = res.rows.slice(0, 200);
  const cell = (b) => {
    if (!b) return "";
    if (b.type === "uri") return `<a href="${esc(b.value)}" target="_blank" title="${esc(b.value)}">${esc(shorten(b.value))}</a>`;
    return esc(b.value) + (b["xml:lang"] ? `<span class="empty">@${esc(b["xml:lang"])}</span>` : "");
  };
  return `<div class="results">
    <div class="count">${res.rows.length} row${res.rows.length === 1 ? "" : "s"} in ${secs}s${res.rows.length > 200 ? " — showing the first 200" : ""}</div>
    <table><thead><tr>${res.vars.map((v) => `<th>?${esc(v)}</th>`).join("")}</tr></thead>
    <tbody>${shown.map((r) => `<tr>${res.vars.map((v) => `<td>${cell(r[v])}</td>`).join("")}</tr>`).join("")}</tbody></table>
  </div>`;
}

function judge(p, mine, ref) {
  const absent = p.check.filter((c) => !mine.vars.includes(c));
  if (absent.length) {
    return `<div class="verdict bad"><b>Not quite.</b> Your result needs a column named ${absent.map((c) => `<code>?${c}</code>`).join(", ")}.</div>`;
  }
  const want = keySet(ref, p.check), got = keySet(mine, p.check);
  const miss = [...want].filter((k) => !got.has(k)), extra = [...got].filter((k) => !want.has(k));
  if (!miss.length && !extra.length) {
    const first = !isSolved(p.id);
    state.solved[p.id] = Date.now();
    save(state);
    updateProgress();
    renderReveal(p);
    const unlocked = children(p.id).filter((c) => unsolvedPrereqs(c).length === 0 && !isSolved(c.id));
    return `<div class="verdict ok"><b>Correct!</b> ${want.size} expected value${want.size === 1 ? "" : "s"} matched.${first ? " Problem solved." : ""}
      ${unlocked.length ? `<div class="next">Unlocked: ${unlocked.map((c) => `<a class="btn" href="#/p/${c.id}">${c.id} · ${esc(c.title)} →</a>`).join("")}</div>` : ""}</div>`;
  }
  const show = (arr) => arr.slice(0, 3).map((k) => `<li><code>${esc(shorten(k))}</code></li>`).join("") + (arr.length > 3 ? `<li>… and ${arr.length - 3} more</li>` : "");
  return `<div class="verdict bad"><b>Not quite.</b> Matched ${want.size - miss.length} of ${want.size} expected value${want.size === 1 ? "" : "s"} in ${p.check.map((c) => `<code>?${c}</code>`).join(", ")}.
    ${miss.length ? `<div>Missing:</div><ul>${show(miss)}</ul>` : ""}
    ${extra.length ? `<div>Unexpected:</div><ul>${show(extra)}</ul>` : ""}</div>`;
}

function renderReveal(p) {
  const box = document.getElementById("reveal");
  if (!box) return;
  if (isSolved(p.id)) {
    box.innerHTML = `<div class="reveal"><h2>Reference solution</h2><pre>${esc(p.solution)}</pre><p>${p.explain}</p></div>`;
  } else {
    box.innerHTML = `<details><summary>Give up and show the solution</summary><pre>${esc(p.solution)}</pre><p>${p.explain}</p></details>`;
  }
}

// ------------------------------------------------------------------ router
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [page, arg] = h.split("/");
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === (page === "p" ? "problems" : page)));
  if (page === "problems") list();
  else if (page === "tree") tree();
  else if (page === "about") about();
  else if (page === "p") problem(arg?.toUpperCase());
  else home();
  updateProgress();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();
