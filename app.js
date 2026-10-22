// Scopoli (a Koetai product) — a Rosalind-style SPARQL problem site. Plain JS, hash routing,
// progress kept in localStorage, answers checked against live endpoints.

const BY_ID = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
const STORE = "koetai.scopoli.v1";
const view = document.getElementById("view");
let editor = null;

// ------------------------------------------------------------------ storage
function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE)); } catch {}
  return Object.assign({ solved: {}, drafts: {}, local: "" }, s || {});
}
function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
}
let state = load();
const isSolved = (id) => !!state.solved[id];
const localEndpoint = () => state.local || "";

function markSolved(p) {
  const first = !isSolved(p.id);
  state.solved[p.id] = Date.now();
  save(state);
  updateProgress();
  return first;
}

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
  ["http://www.orpha.net/ORDO/", "ordo:"],
  ["https://w3id.org/ofco/", "ofco:"],
  ["http://www.semanticweb.org/ontology/HOOM#", "hoom:"],
];
function shorten(iri) {
  for (const [long, pre] of SHORT) if (iri.startsWith(long)) return pre + iri.slice(long.length);
  return iri;
}
const trackDot = (t) => `<span class="dot" style="background:${TRACKS[t].color}"></span>`;
const kindOf = (p) => p.kind || "query";
// A problem may require all of `prereqs` plus at least one of `prereqsAny`
// (used where learners pick one of several triplestores).
function unsolvedPrereqs(p) {
  const missing = p.prereqs.filter((id) => !isSolved(id));
  if (p.prereqsAny && !p.prereqsAny.some(isSolved)) missing.push(p.prereqsAny.join(" | "));
  return missing;
}
const children = (id) => PROBLEMS.filter((p) => p.prereqs.includes(id) || (p.prereqsAny || []).includes(id));
const dataLabel = (p) => {
  if (kindOf(p) === "guide") return "Guide";
  if (kindOf(p) === "answer") return "Python";
  if (kindOf(p) === "connect") return "Your endpoint";
  return ENDPOINTS[p.endpoint].name.split(" (")[0].split(" · ").pop();
};

function updateProgress() {
  const n = PROBLEMS.filter((p) => isSolved(p.id)).length;
  document.getElementById("progress").textContent = `${n} / ${PROBLEMS.length} solved`;
}

// --------------------------------------------------------------- SPARQL I/O
async function runQuery(endpointKey, query) {
  return runQueryAt(ENDPOINTS[endpointKey].url, query);
}

async function runQueryAt(url, query) {
  if (!url) throw new Error("No local endpoint set yet. Connect one in the “Your endpoint” chapter or under Settings.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch(url, {
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
    if (e.name === "AbortError") throw new Error("The query timed out after 120 seconds.");
    if (e instanceof TypeError) {
      if (!/localhost|127\.0\.0\.1|\[::1\]/.test(url)) throw new Error("Network error — the endpoint may be down or unreachable.");
      let msg = "Can't reach your endpoint. Is it running, and does it send CORS headers?";
      if (location.protocol === "https:") {
        msg += " Browsers may also stop a public https page from calling your own machine: allow local-network access if your browser asks, or run Scopoli locally — git clone https://github.com/Koetai/scopoli && cd scopoli && python3 -m http.server 8000 — and open http://localhost:8000.";
      }
      throw new Error(msg);
    }
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
  const key = p.id + " " + ENDPOINTS[p.endpoint].url;
  if (!refCache[key]) refCache[key] = runQuery(p.endpoint, p.solution).catch((e) => { delete refCache[key]; throw e; });
  return refCache[key];
}

// Local problems need specific datasets loaded; say which one is missing.
async function missingData(p) {
  for (const need of p.needs || []) {
    const probe = PROBES[need];
    const res = await runQuery(p.endpoint, probe.q);
    if (!res.rows.length) return probe.what;
  }
  return null;
}

// ------------------------------------------------------------------- views
const trackBlurb = {
  py: "Set up Python with rdflib, parse an ontology, run SPARQL without a server and join XML to RDF.",
  ep: "What a SPARQL endpoint is, and how to run your own: Oxigraph, Fuseki, QLever, Virtuoso, GraphDB, Blazegraph or Comunica.",
  dt: "Find, convert, clean and load Orphanet's ORDO, HOOM and OFCO plus HPO, and integrate them in one graph.",
  rd: "Rare-disease questions on your own endpoint: cross-references, genes, hierarchies, phenotypes, functional consequences, federation.",
  wd: "Core SPARQL — patterns, OPTIONAL, FILTER, aggregates, paths, UNION, NOT EXISTS, VALUES — on genes, drugs and diseases in Wikidata.",
  sib: "Curated protein knowledge in UniProt, federation with Rhea reactions, and bridging Wikidata to UniProt.",
  rp: "MeSH, ChEMBL and ClinVar on the DBCLS RDF Portal: named graphs, shared IRIs and deeply nested real-world RDF.",
};
const TRACK_ORDER = ["py", "ep", "dt", "rd", "wd", "sib", "rp"];

function home() {
  const counts = TRACK_ORDER.map((t) => {
    const ps = PROBLEMS.filter((p) => p.track === t);
    return { t, total: ps.length, done: ps.filter((p) => isSolved(p.id)).length, first: ps[0] };
  });
  const next = PROBLEMS.find((p) => !isSolved(p.id) && unsolvedPrereqs(p).length === 0);
  const started = Object.keys(state.solved).length > 0;
  view.innerHTML = `
    <section class="hero">
      <h1>Learn SPARQL by solving biomedical problems</h1>
      <p>Start by setting up Python and your own SPARQL endpoint, integrate Orphanet's rare-disease ontologies, query them, then move out to Wikidata, UniProt and RDF Portal. Each problem is a small research question answered with a live query. Solve one to unlock the next.</p>
      <p>${next ? `<a class="btn primary" href="#/p/${next.id}">${started ? "Continue" : "Start"} with ${next.id} · ${esc(next.title)} →</a>` : `<span class="btn primary">All problems solved 🎉</span>`}
      <a class="btn" href="#/tree">View the tree</a></p>
    </section>
    <div class="tracks">
      ${counts.map(({ t, total, done, first }, i) => `
        <div class="card">
          <div class="step">Chapter ${i + 1}</div>
          <h3>${trackDot(t)}${TRACKS[t].name}</h3>
          <div class="empty">${trackBlurb[t]}</div>
          <p style="margin:10px 0 0;font-size:13px">${done} / ${total} solved · starts at <a href="#/p/${first.id}">${first.id}</a></p>
        </div>`).join("")}
    </div>`;
}

let listFilter = "all";
function list() {
  const rows = PROBLEMS.filter((p) => listFilter === "all" || p.track === listFilter);
  view.innerHTML = `
    <h1>Problems</h1>
    <div class="filters">
      <button class="chip ${listFilter === "all" ? "on" : ""}" data-f="all">All</button>
      ${TRACK_ORDER.map((k) => `<button class="chip ${listFilter === k ? "on" : ""}" data-f="${k}">${trackDot(k)}${TRACKS[k].name}</button>`).join("")}
    </div>
    <div class="table-scroll"><table class="list">
      <thead><tr><th>ID</th><th>Title</th><th>Concept</th><th>Data</th><th>Status</th></tr></thead>
      <tbody>${rows.map((p) => `
        <tr>
          <td class="id">${trackDot(p.track)}<a href="#/p/${p.id}">${p.id}</a></td>
          <td><a href="#/p/${p.id}">${esc(p.title)}</a></td>
          <td class="concept">${esc(p.concept)}</td>
          <td class="concept">${esc(dataLabel(p))}</td>
          <td>${isSolved(p.id) ? '<span class="solved">✓ solved</span>' : unsolvedPrereqs(p).length ? '<span class="empty">locked</span>' : "open"}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
  view.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { listFilter = b.dataset.f; list(); }));
}

function tree() {
  // Layer = longest path from a root, then order each layer by parents' position.
  const parents = (id) => [...BY_ID[id].prereqs, ...(BY_ID[id].prereqsAny || [])];
  const level = {};
  const depth = (id) => level[id] ?? (level[id] = Math.max(-1, ...parents(id).map(depth)) + 1);
  PROBLEMS.forEach((p) => depth(p.id));
  const layers = [];
  PROBLEMS.forEach((p) => (layers[level[p.id]] ||= []).push(p.id));
  const order = Object.fromEntries(TRACK_ORDER.map((t, i) => [t, i]));
  const xpos = {};
  layers.forEach((ids) => {
    const bary = (id) => { const ps = parents(id); return ps.length ? ps.reduce((s, q) => s + xpos[q], 0) / ps.length : 0; };
    ids.sort((a, b) => order[BY_ID[a].track] - order[BY_ID[b].track] || bary(a) - bary(b));
    ids.forEach((id, i) => (xpos[id] = i - (ids.length - 1) / 2));
  });
  const W = 118, H = 92, NW = 96, NH = 44;
  const maxW = Math.max(...layers.map((l) => l.length));
  const width = maxW * W + 40, height = layers.length * H + 30;
  const cx = (id) => width / 2 + xpos[id] * W;
  const cy = (id) => 30 + level[id] * H;
  let edges = "", nodes = "";
  const edge = (q, id, cls) => {
    const x1 = cx(q), y1 = cy(q) + NH / 2, x2 = cx(id), y2 = cy(id) - NH / 2, my = (y1 + y2) / 2;
    edges += `<path class="edge ${cls}" d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"/>`;
  };
  PROBLEMS.forEach((p) => {
    p.prereqs.forEach((q) => edge(q, p.id, ""));
    (p.prereqsAny || []).forEach((q) => edge(q, p.id, "any"));
  });
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
    <p class="empty">Arrows point from a problem to the problems it unlocks. Dashed arrows mean "any one of these" — you only need one triplestore. Filled boxes are solved.</p>
    <div class="tree-box"><svg viewBox="0 0 ${width} ${height}" width="${width}" role="img" aria-label="Problem dependency tree">${edges}${nodes}</svg></div>
    <div class="legend">${TRACK_ORDER.map((k) => `<span>${trackDot(k)}${TRACKS[k].name}</span>`).join("")}</div>`;
}

function about() {
  view.innerHTML = `<div class="about">
    <h1>About</h1>
    <p>Scopoli teaches SPARQL the way <a href="https://rosalind.info" target="_blank">Rosalind</a> teaches bioinformatics: through a tree of small, self-contained problems grounded in real biology. It is part of <a href="https://koetai.github.io/" target="_blank">Koetai</a>, open SPARQL tooling for the life sciences.</p>
    <h2>Why "Scopoli"?</h2>
    <p><i>Koetai</i> takes its name from the four-eyed fish <i>Anableps</i>, which swims at the surface of mangrove waters and sees above and below the waterline at once. The Tyrolean naturalist <a href="https://www.wikidata.org/wiki/Q84181" target="_blank">Giovanni Antonio Scopoli</a> (1723–1788) established the genus <a href="https://www.wikidata.org/wiki/Q1976257" target="_blank"><i>Anableps</i></a> in 1777. Like a good query, the fish looks at two worlds at the same time.</p>
    <h2>How checking works</h2>
    <p>When you press <b>Submit</b>, your query and a reference solution both run live against the same endpoint — for the rare-disease chapters, <i>your own</i>. Your answer is correct when the set of values in the checked columns matches. Column names matter (they're listed under <i>Return</i>); extra columns and row order don't. Because both run on the same data, answers stay valid as the knowledge graphs grow.</p>
    <h2>Data and licences</h2>
    <p>ORDO, HOOM, OFCO and the functional-consequence data are © Orphanet/INSERM, CC BY 4.0, via <a href="https://sciences.orphadata.com/" target="_blank">Orphadata</a> and <a href="https://github.com/Orphanet/ofco-ontology" target="_blank">GitHub</a>. HPO is from <a href="https://hpo.jax.org/" target="_blank">hpo.jax.org</a>. Scripts to rebuild the dataset are in <a href="https://github.com/Koetai/scopoli/tree/main/prepare" target="_blank">prepare/</a>.</p>
    <h2>Endpoints</h2>
    <ul>${Object.entries(ENDPOINTS).map(([k, e]) => `<li><b>${esc(e.name)}</b> — <code>${esc(e.url || "not set")}</code></li>`).join("")}</ul>
    <p>Your progress, drafts and local endpoint are stored only in this browser.</p>
    <p><button class="btn" id="reset">Reset my progress</button></p>
  </div>`;
  document.getElementById("reset").addEventListener("click", () => {
    if (confirm("Forget all solved problems, drafts and your local endpoint?")) { state = load(); state.solved = {}; state.drafts = {}; state.local = ""; save(state); updateProgress(); about(); }
  });
}

function settings() {
  view.innerHTML = `<div class="about">
    <h1>Settings</h1>
    <h2>Local SPARQL endpoint</h2>
    <p>The rare-disease chapters run against a triplestore on your own machine. Set it up in the <a href="#/p/ENDP">“Your endpoint”</a> chapter.</p>
    ${endpointForm(localEndpoint() || "http://localhost:7878/query")}
    <div id="verdict"></div>
  </div>`;
  wireEndpointForm(null);
}

function endpointForm(value) {
  return `<div class="connect">
    <label for="ep-url">Endpoint URL</label>
    <div class="actions"><input id="ep-url" type="url" spellcheck="false" value="${esc(value)}">
    <button class="btn primary" id="connect">Connect</button></div>
  </div>`;
}

function wireEndpointForm(p) {
  const btn = document.getElementById("connect"), input = document.getElementById("ep-url");
  const go = async () => {
    const url = input.value.trim(), verdict = document.getElementById("verdict");
    btn.disabled = true;
    verdict.innerHTML = `<div class="verdict info">Contacting ${esc(url)}…</div>`;
    try {
      const res = await runQueryAt(url, "SELECT * WHERE { ?s ?p ?o } LIMIT 1");
      state.local = url;
      save(state);
      let msg = `<b>Connected.</b> ${res.rows.length ? "The store answers and already holds data." : "The store answers; it's still empty."} Scopoli will use <code>${esc(url)}</code> for local problems.`;
      if (p) {
        markSolved(p);
        renderReveal(p);
        msg += nextLinks(p);
      }
      verdict.innerHTML = `<div class="verdict ok">${msg}</div>`;
    } catch (e) {
      verdict.innerHTML = `<div class="verdict bad"><b>Couldn't connect.</b> ${esc(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  };
  btn.addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}

function nextLinks(p) {
  const unlocked = children(p.id).filter((c) => unsolvedPrereqs(c).length === 0 && !isSolved(c.id));
  return unlocked.length ? `<div class="next">Unlocked: ${unlocked.map((c) => `<a class="btn" href="#/p/${c.id}">${c.id} · ${esc(c.title)} →</a>`).join("")}</div>` : "";
}

function problem(id) {
  const p = BY_ID[id];
  if (!p) { view.innerHTML = `<p>No problem called ${esc(id)}. <a href="#/problems">Back to the list</a>.</p>`; return; }
  const kind = kindOf(p);
  const missing = unsolvedPrereqs(p);
  const anyNote = p.prereqsAny ? `<span>After any of: ${p.prereqsAny.map((q) => `<a href="#/p/${q}">${q}</a>`).join(" · ")}</span>` : "";
  view.innerHTML = `
    <div class="crumbs"><a href="#/problems">Problems</a> › ${trackDot(p.track)}${TRACKS[p.track].name}</div>
    <div class="ptitle"><span class="pid">${p.id}</span><h1>${esc(p.title)}</h1></div>
    <div class="meta">
      <span>Concept: <b>${esc(p.concept)}</b></span>
      ${p.prereqs.length ? `<span>After: ${p.prereqs.map((q) => `<a href="#/p/${q}">${q}</a>`).join(", ")}</span>` : ""}
      ${anyNote}
      ${isSolved(p.id) ? '<span class="badge solved-badge">✓ solved</span>' : ""}
    </div>
    ${missing.length ? `<div class="note">Recommended first: ${missing.map((q) => BY_ID[q] ? `<a href="#/p/${q}">${q} · ${esc(BY_ID[q].title)}</a>` : `one of ${q.split(" | ").map((s) => `<a href="#/p/${s}">${s}</a>`).join(", ")}`).join("; ")}. You can still try this one.</div>` : ""}
    <div class="cols ${kind === "guide" ? "guide" : ""}">
      <div>
        <div class="section"><h2>Background</h2>${p.story}</div>
        <div class="section"><h2>${kind === "query" ? "The concept" : "How to"}</h2>${p.lesson}</div>
        <div class="section"><h2>${kind === "guide" ? "Your step" : "Problem"}</h2>
          <div class="task">${p.task}${kind === "query" ? `
            <div class="ret"><b>Return:</b> ${p.returns.map((v) => `<code>?${v}</code>`).join(" ")}
            ${p.check.length < p.returns.length ? ` · checked on ${p.check.map((v) => `<code>?${v}</code>`).join(" ")}` : ""}</div>` : ""}
          </div>
          ${p.sample ? `<details><summary>Sample output</summary><pre>${esc(p.sample)}</pre></details>` : ""}
          ${p.hint ? `<details><summary>Hint</summary><p>${p.hint}</p></details>` : ""}
          <div id="reveal"></div>
        </div>
      </div>
      <div class="editor-pane" id="pane"></div>
    </div>`;
  const pane = document.getElementById("pane");

  if (kind === "guide") {
    pane.innerHTML = `<div class="card done-card">
      <p>${isSolved(p.id) ? "You've completed this step." : "Work through the steps on the left, then come back here."}</p>
      <button class="btn primary" id="done">${isSolved(p.id) ? "✓ Done" : "Mark as done"}</button>
      <div id="verdict"></div></div>`;
    document.getElementById("done").addEventListener("click", () => {
      markSolved(p);
      document.getElementById("done").textContent = "✓ Done";
      document.getElementById("verdict").innerHTML = `<div class="verdict ok"><b>Done.</b>${nextLinks(p)}</div>`;
    });
    return;
  }

  if (kind === "answer") {
    pane.innerHTML = `<div class="card done-card">
      <label for="answer">Your answer</label>
      <div class="actions"><input id="answer" type="text" spellcheck="false" autocomplete="off" placeholder="type your answer">
      <button class="btn primary" id="submit">Submit answer</button></div>
      <div id="verdict"></div></div>`;
    const input = document.getElementById("answer");
    const check = () => {
      const verdict = document.getElementById("verdict");
      const clean = (s) => s.trim().replace(/^<|>$/g, "").replace(/^https:\/\/w3id\.org\/ofco\//, "").replace(/^ofco:/, "").replace(/[,\s]/g, "").toLowerCase();
      if (clean(input.value) === clean(p.answer)) {
        const first = markSolved(p);
        renderReveal(p);
        verdict.innerHTML = `<div class="verdict ok"><b>Correct!</b>${first ? " Problem solved." : ""}${nextLinks(p)}</div>`;
      } else {
        verdict.innerHTML = `<div class="verdict bad"><b>Not quite.</b> Check that you used the pinned file version, then try again.</div>`;
      }
    };
    document.getElementById("submit").addEventListener("click", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    renderReveal(p);
    return;
  }

  if (kind === "connect") {
    pane.innerHTML = `<div class="card done-card">${endpointForm(localEndpoint() || p.defaultUrl)}
      <p class="empty" style="font-size:13px">Default for this store: <code>${esc(p.defaultUrl)}</code></p>
      <div id="verdict"></div></div>`;
    wireEndpointForm(p);
    return;
  }

  const ep = ENDPOINTS[p.endpoint];
  const isLocal = p.endpoint === "local";
  pane.innerHTML = `
    <div class="endpoint"><span>Endpoint: <b>${esc(ep.name)}</b>${isLocal ? ` <code>${esc(localEndpoint() || "not set")}</code> · <a href="#/settings">change</a>` : ""}</span>${isLocal ? "" : `<a href="#" id="open-ui" target="_blank">open in endpoint UI ↗</a>`}</div>
    <textarea id="q"></textarea>
    <div class="actions">
      <button class="btn" id="run">▶ Run</button>
      <button class="btn primary" id="submit">Submit answer</button>
      <span class="spacer"></span>
      <span class="kbd">⌘/Ctrl + Enter to run</span>
      <button class="btn" id="reset-q" title="Restore the starter query">Reset</button>
    </div>
    <div id="verdict"></div>
    <div id="out"></div>`;

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

  if (!isLocal) document.getElementById("open-ui").addEventListener("click", (e) => { e.currentTarget.href = ep.ui(editor.getValue()); });
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
      if (submit && p.needs) {
        const absent = await missingData(p);
        if (absent) {
          verdict.innerHTML = `<div class="verdict bad"><b>Data missing.</b> Your endpoint doesn't seem to contain ${esc(absent)} yet. Load it first (see <a href="#/p/LORD">LORD</a>).</div>`;
          return;
        }
      }
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
    const first = markSolved(p);
    renderReveal(p);
    return `<div class="verdict ok"><b>Correct!</b> ${want.size} expected value${want.size === 1 ? "" : "s"} matched.${first ? " Problem solved." : ""}${nextLinks(p)}</div>`;
  }
  const show = (arr) => arr.slice(0, 3).map((k) => `<li><code>${esc(shorten(k))}</code></li>`).join("") + (arr.length > 3 ? `<li>… and ${arr.length - 3} more</li>` : "");
  return `<div class="verdict bad"><b>Not quite.</b> Matched ${want.size - miss.length} of ${want.size} expected value${want.size === 1 ? "" : "s"} in ${p.check.map((c) => `<code>?${c}</code>`).join(", ")}.
    ${miss.length ? `<div>Missing:</div><ul>${show(miss)}</ul>` : ""}
    ${extra.length ? `<div>Unexpected:</div><ul>${show(extra)}</ul>` : ""}</div>`;
}

function renderReveal(p) {
  const box = document.getElementById("reveal");
  if (!box || !p.explain) return;
  const body = p.solution ? `<pre>${esc(p.solution)}</pre>` : p.answer ? `<p>Answer: <code>${esc(p.answer)}</code></p>` : "";
  if (isSolved(p.id)) {
    box.innerHTML = `<div class="reveal"><h2>${p.solution ? "Reference solution" : "Explanation"}</h2>${body}<p>${p.explain}</p></div>`;
  } else if (kindOf(p) !== "connect") {
    box.innerHTML = `<details><summary>Give up and show the solution</summary>${body}<p>${p.explain}</p></details>`;
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
  else if (page === "settings") settings();
  else if (page === "p") problem(arg?.toUpperCase());
  else home();
  updateProgress();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();
