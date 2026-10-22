// Chapters that run before the public endpoints: Python, a local SPARQL
// endpoint, integrating Orphanet data (ORDO, HOOM, OFCO), and rare-disease
// queries against that local endpoint.

ENDPOINTS.local = {
  name: "Your local endpoint",
  get url() { return localEndpoint(); },
  ui: () => localEndpoint(),
  home: "#/settings",
};

Object.assign(TRACKS, {
  py: { name: "Python village", color: "var(--t-py)" },
  ep: { name: "Your endpoint", color: "var(--t-ep)" },
  dt: { name: "Rare disease data", color: "var(--t-dt)" },
  rd: { name: "Rare disease queries", color: "var(--t-rd)" },
});

const REPO = "https://github.com/Koetai/scopoli/blob/main/prepare/";
const RAW = "https://raw.githubusercontent.com/Koetai/scopoli/main/prepare/";
const OFCO_URL = "https://raw.githubusercontent.com/Orphanet/ofco-ontology/43c5989021d8d2ec83ae8fc03569891abc12c951/OFCO.owl";
const code = (s) => `<pre>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;

const RD_PREFIXES = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX oboInOwl: <http://www.geneontology.org/formats/oboInOwl#>
PREFIX obo: <http://purl.obolibrary.org/obo/>
PREFIX ordo: <http://www.orpha.net/ORDO/>
PREFIX oban: <http://purl.org/oban/>
PREFIX hoom: <http://www.semanticweb.org/ontology/HOOM#>
PREFIX ofco: <https://w3id.org/ofco/>
PREFIX fc: <https://koetai.github.io/scopoli/vocab#>
`;

// Run before a local problem is checked, so an empty store is reported as
// "data missing" instead of a trivially matching empty answer.
const PROBES = {
  ordo: { what: "ORDO", q: `SELECT ?x WHERE { <http://www.orpha.net/ORDO/Orphanet_558> <http://www.w3.org/2004/02/skos/core#notation> ?x } LIMIT 1` },
  hoom: { what: "HOOM", q: `SELECT ?x WHERE { ?x <http://www.w3.org/2002/07/owl#onProperty> <http://purl.org/oban/association_has_subject> } LIMIT 1` },
  hpo: { what: "HPO", q: `SELECT ?x WHERE { ?x <http://www.w3.org/2000/01/rdf-schema#label> "Arachnodactyly" } LIMIT 1` },
  ofco: { what: "OFCO", q: `SELECT ?x WHERE { <https://w3id.org/ofco/AcquiringLanguage> <http://www.w3.org/2000/01/rdf-schema#label> ?x } LIMIT 1` },
  fc: { what: "the functional consequences (fc.nt)", q: `SELECT ?x WHERE { ?x a <https://koetai.github.io/scopoli/vocab#FunctionalConsequence> } LIMIT 1` },
};

const STORE_IDS = ["OXIG", "FUSK", "QLEV", "VIRT", "GRDB", "BLZG", "COMU"];

const LOAD_TABLE = `
<details><summary>Oxigraph</summary>${code(`docker run --rm -v "$PWD/data":/data:ro -v oxigraph:/store \\
  ghcr.io/oxigraph/oxigraph:0.5.12 load --location /store \\
  --file /data/ordo.nt /data/hoom.nt /data/hp.nt /data/ofco.nt /data/fc.nt
docker restart oxigraph`)}</details>
<details><summary>Apache Jena Fuseki</summary>${code(`# stop Fuseki first (Ctrl-C), then bulk-load into its TDB2 database
apache-jena-6.2.0/bin/tdb2.tdbloader --loc db data/*.nt
apache-jena-fuseki-6.2.0/fuseki-server --loc=db --port 3030 /rare`)}</details>
<details><summary>QLever</summary>${code(`# in the folder with your Qleverfile; INPUT_FILES = *.nt
cp data/*.nt .
qlever index --overwrite-existing
qlever start`)}</details>
<details><summary>Virtuoso</summary>${code(`docker exec virtuoso isql 1111 dba "$DBA_PASSWORD" exec="
  ld_dir('/data', '*.nt', 'https://koetai.github.io/scopoli/graph/rare');
  rdf_loader_run(); checkpoint;"`)}
<p>Virtuoso's default graph is the union of all graphs, so queries without <code>FROM</code> see the data.</p></details>
<details><summary>GraphDB</summary><p>Copy the five files into the <code>graphdb-import</code> folder you mounted, then in the Workbench open <b>Import → Server files</b>, select them and import into the <code>rare</code> repository.</p></details>
<details><summary>Blazegraph</summary>${code(`for f in ordo ofco fc hp hoom; do
  curl -X POST --data-urlencode "update=LOAD <file:///data/$f.nt>" \\
    http://localhost:9999/bigdata/sparql
done`)}</details>
<details><summary>Comunica</summary>${code(`comunica-sparql-file-http data/ordo.nt data/hp.nt data/ofco.nt data/fc.nt -p 3000 -t 300`)}
<p>Comunica re-reads files on every query. Leave the 3.6-million-triple <code>hoom.nt</code> out, or switch to a database for the HOOM problems.</p></details>`;

const LOCAL_PROBLEMS = [
  // ------------------------------------------------------------ Python village
  {
    id: "PYIN",
    title: "Installing Python",
    track: "py",
    kind: "guide",
    concept: "Python, virtual environments, rdflib",
    prereqs: [],
    story: `
      <p>Rosalind starts with Python, and so do we. You will use Python to download and reshape rare-disease data before it goes into a triplestore, and later to talk to SPARQL endpoints from scripts.</p>`,
    lesson: `
      <h3>1. Install Python 3.11 or newer</h3>
      <p>Get it from <a href="https://www.python.org/downloads/" target="_blank">python.org</a>, your package manager (<code>brew install python</code>, <code>apt install python3</code>), or with <a href="https://docs.astral.sh/uv/" target="_blank">uv</a>. Check the version:</p>
      ${code(`python3 --version`)}
      <h3>2. Make a project folder with a virtual environment</h3>
      <p>A virtual environment keeps this course's packages separate from the rest of your system.</p>
      ${code(`mkdir scopoli && cd scopoli
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
pip install rdflib SPARQLWrapper`)}
      <h3>3. Check that it works</h3>
      ${code(`python -c "import rdflib, SPARQLWrapper; print('rdflib', rdflib.__version__)"`)}
      <p><b>macOS tip:</b> if Python later fails with <code>CERTIFICATE_VERIFY_FAILED</code> when downloading, run <i>Install Certificates.command</i> from your Python folder in Applications.</p>
      <p>You'll also need <b>Docker</b> (<a href="https://docs.docker.com/get-docker/" target="_blank">docs.docker.com/get-docker</a>) for most triplestores, and <b>Java 21+</b> for Jena and ROBOT.</p>`,
    task: `Install Python with <code>rdflib</code> and <code>SPARQLWrapper</code> in a virtual environment, then mark this step as done.`,
  },
  {
    id: "PYRD",
    title: "Counting Triples",
    track: "py",
    kind: "answer",
    concept: "Parsing RDF with rdflib",
    prereqs: ["PYIN"],
    story: `
      <p>Orphanet describes the <b>functional consequences</b> of rare diseases — what people can and cannot do in daily life, such as walking, eating or going to school — with <b>OFCO</b>, the Orphanet Functional Consequences Ontology. It is derived from the WHO's International Classification of Functioning (ICF) and is published on <a href="https://github.com/Orphanet/ofco-ontology" target="_blank">GitHub</a> as an OWL file in RDF/XML.</p>`,
    lesson: `
      <p>An RDF graph is a set of triples. <code>rdflib</code> reads a file into a <code>Graph</code>, and <code>len(graph)</code> tells you how many triples it holds:</p>
      ${code(`from rdflib import Graph

g = Graph()
g.parse("some-ontology.owl", format="xml")   # RDF/XML
print(len(g))`)}`,
    task: `Download <a href="${OFCO_URL}" target="_blank">this exact version of OFCO.owl</a> (pinned so everyone gets the same answer), load it with rdflib and enter the number of triples.`,
    answer: "4789",
    hint: `<code>curl -LO</code> the URL, or pass the URL straight to <code>g.parse()</code>.`,
    explain: `4,789 triples. A good share of them are <code>owl:Restriction</code> blank nodes and annotations rather than "facts" — you'll meet these patterns again in ORDO and HOOM.`,
  },
  {
    id: "PYSQ",
    title: "SPARQL Without a Server",
    track: "py",
    kind: "answer",
    concept: "rdflib's built-in SPARQL engine",
    prereqs: ["PYRD"],
    story: `
      <p>OFCO maps its terms to the WHO ICF with <code>ofco:hasICFcode</code> (prefix <code>ofco: &lt;https://w3id.org/ofco/&gt;</code>). Mappings like these are what let Orphanet's data be compared with disability registries that use ICF codes.</p>`,
    lesson: `
      <p>You don't need a server to run SPARQL: rdflib executes queries against an in-memory graph.</p>
      ${code(`q = """
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT (COUNT(DISTINCT ?term) AS ?n) WHERE { ?term rdfs:label ?label }
"""
for row in g.query(q):
    print(row.n)`)}
      <p>This is handy for small files. For millions of triples you'll want a real triplestore — that's the next chapter.</p>`,
    task: `Using the same OFCO graph, how many distinct terms have at least one <code>ofco:hasICFcode</code>?`,
    answer: "252",
    hint: `Adapt the example: swap <code>rdfs:label</code> for <code>ofco:hasICFcode</code> and declare the prefix.`,
    explain: `252 terms carry an ICF code. Those without one are grouping terms OFCO added itself.`,
  },
  {
    id: "PYXM",
    title: "From XML to Identifiers",
    track: "py",
    kind: "answer",
    concept: "Reading XML; joining on identifiers",
    prereqs: ["PYSQ"],
    story: `
      <p>Which diseases cause which limitations is not in OFCO itself. Orphanet publishes it as XML on <a href="https://sciences.orphadata.com/functional-consequences/" target="_blank">Orphadata</a>: <code>en_funct_consequences.xml</code>. In that file each limitation appears as <code>&lt;Disability id="…"&gt;</code>. OFCO stores the same id on every term, as an OWL restriction on <code>ofco:hasORPHANETDBInternalReference</code>. That shared number is the bridge between the two.</p>`,
    lesson: `
      <p>Python's standard library reads XML:</p>
      ${code(`import xml.etree.ElementTree as ET
root = ET.parse("en_funct_consequences.xml").getroot()
for d in root.iter("Disability"):
    print(d.get("id"), d.findtext("Name"))`)}
      <p>And a SPARQL property path can dig the id out of OFCO's OWL restrictions:</p>
      ${code(`SELECT ?term ?id WHERE {
  ?term owl:equivalentClass/owl:intersectionOf/rdf:rest*/rdf:first ?r .
  ?r owl:onProperty ofco:hasORPHANETDBInternalReference ;
     owl:hasValue ?id .
}`)}`,
    task: `In the XML, find the name of the limitation with <code>Disability id="55"</code>. Then find the OFCO term whose internal reference is 55 and enter its <b>local name</b> (the part of the IRI after <code>https://w3id.org/ofco/</code>).`,
    answer: "CaringForBodyParts",
    hint: `<code>rdf:rest*/rdf:first</code> walks an RDF list — OWL stores intersections as lists.`,
    explain: `<code>ofco:CaringForBodyParts</code>. Turning the whole XML file into RDF with this join is exactly what <a href="${REPO}fc_to_rdf.py" target="_blank">fc_to_rdf.py</a> does — you'll run it in the data chapter.`,
  },

  // ---------------------------------------------------------- Your endpoint
  {
    id: "ENDP",
    title: "What Is a SPARQL Endpoint?",
    track: "ep",
    kind: "guide",
    concept: "The SPARQL 1.1 Protocol",
    prereqs: ["PYIN"],
    story: `
      <p>A SPARQL endpoint is just a web address that accepts a query and returns results. Every triplestore in the next problems — and Wikidata, UniProt and RDF Portal later — speaks the same <a href="https://www.w3.org/TR/sparql11-protocol/" target="_blank">SPARQL 1.1 Protocol</a>.</p>`,
    lesson: `
      <p>Send the query as a form field named <code>query</code>, and say which result format you want with the <code>Accept</code> header:</p>
      ${code(`curl -H 'Accept: application/sparql-results+json' \\
     --data-urlencode 'query=SELECT ?x WHERE { wd:Q42 rdfs:label ?x } LIMIT 3' \\
     https://query.wikidata.org/sparql`)}
      <p>The same from Python:</p>
      ${code(`from SPARQLWrapper import SPARQLWrapper, JSON
s = SPARQLWrapper("https://query.wikidata.org/sparql", agent="scopoli-student/1.0")
s.setQuery("SELECT ?x WHERE { wd:Q42 rdfs:label ?x } LIMIT 3")
s.setReturnFormat(JSON)
print(s.query().convert()["results"]["bindings"])`)}
      <h3>Running your own</h3>
      <p>For the rare-disease chapters you'll host the data yourself. Pick <b>one</b> triplestore from the next problems — each solves this chapter:</p>
      <table class="mini">
        <tr><th>Store</th><th>Good for</th><th>Needs</th></tr>
        <tr><td><a href="#/p/OXIG">Oxigraph</a></td><td>Smallest set-up; fast loading</td><td>Docker or one binary</td></tr>
        <tr><td><a href="#/p/FUSK">Jena Fuseki</a></td><td>The reference Java implementation</td><td>Java 21</td></tr>
        <tr><td><a href="#/p/QLEV">QLever</a></td><td>Very fast on billions of triples</td><td>Docker + Python</td></tr>
        <tr><td><a href="#/p/VIRT">Virtuoso</a></td><td>Runs UniProt, DBpedia and RDF Portal</td><td>Docker</td></tr>
        <tr><td><a href="#/p/GRDB">GraphDB</a></td><td>Reasoning, polished Workbench</td><td>Docker + free licence</td></tr>
        <tr><td><a href="#/p/BLZG">Blazegraph</a></td><td>Wikidata's engine for a decade</td><td>Docker (x86)</td></tr>
        <tr><td><a href="#/p/COMU">Comunica</a></td><td>Querying files and federating sources</td><td>Node.js</td></tr>
      </table>
      <h3>Letting this page reach your machine</h3>
      <p>Scopoli runs in your browser and sends queries straight to <code>http://localhost:…</code>. The store must send <b>CORS</b> headers; each guide shows how. Browsers are also wary of a public https page calling your own machine. Chrome asks whether <i>koetai.github.io</i> may access devices on your local network (click <b>Allow</b>), and some browsers or extensions simply block it. The dependable route is to run Scopoli itself locally:</p>
      ${code(`git clone https://github.com/Koetai/scopoli
cd scopoli
python3 -m http.server 8000      # then open http://localhost:8000`)}
      <p>Your progress is stored per site, so pick one address and stay with it.</p>`,
    task: `Run the <code>curl</code> example against Wikidata, then mark this step as done and choose a triplestore.`,
  },
  {
    id: "OXIG",
    title: "Oxigraph",
    track: "ep",
    kind: "connect",
    concept: "Running Oxigraph",
    prereqs: ["ENDP"],
    defaultUrl: "http://localhost:7878/query",
    story: `<p><a href="https://github.com/oxigraph/oxigraph" target="_blank">Oxigraph</a> is a compact SPARQL database written in Rust. It is a single program with no configuration, which makes it the quickest way to get a standards-compliant endpoint running.</p>`,
    lesson: `
      <h3>Start it with Docker</h3>
      ${code(`docker volume create oxigraph
docker run -d --name oxigraph -p 7878:7878 -v oxigraph:/store \\
  ghcr.io/oxigraph/oxigraph:0.5.12 serve --location /store --bind 0.0.0.0:7878 --cors`)}
      <p><code>--cors</code> lets web pages such as this one read the results. Open <a href="http://localhost:7878" target="_blank">localhost:7878</a> for Oxigraph's own query editor. The SPARQL endpoint is <code>http://localhost:7878/query</code>.</p>
      <h3>Loading files</h3>
      <p>Bulk-load while the server is stopped, into the same volume:</p>
      ${code(`docker stop oxigraph
docker run --rm -v "$PWD/data":/data:ro -v oxigraph:/store \\
  ghcr.io/oxigraph/oxigraph:0.5.12 load --location /store --file /data/example.nt
docker start oxigraph`)}
      <p>Without Docker, download a binary from the <a href="https://github.com/oxigraph/oxigraph/releases" target="_blank">releases page</a> and run <code>oxigraph serve --location store --cors</code>. Python users can also <code>pip install pyoxigraph</code> to embed the same engine in scripts.</p>`,
    task: `Start Oxigraph, enter its endpoint URL below and press <b>Connect</b>.`,
  },
  {
    id: "FUSK",
    title: "Apache Jena Fuseki",
    track: "ep",
    kind: "connect",
    concept: "Running Fuseki with TDB2",
    prereqs: ["ENDP"],
    defaultUrl: "http://localhost:3030/rare/sparql",
    story: `<p><a href="https://jena.apache.org/documentation/fuseki2/" target="_blank">Fuseki</a> is the SPARQL server of Apache Jena, the long-standing Java toolkit for RDF. Jena's command-line tools — <code>riot</code> for converting and validating files, <code>tdb2.tdbloader</code> for bulk loading — are useful whichever store you choose.</p>`,
    lesson: `
      <h3>Install</h3>
      <p>You need Java 21 or newer (<code>java -version</code>). Download and unpack Jena and Fuseki from <a href="https://jena.apache.org/download/" target="_blank">jena.apache.org/download</a>:</p>
      ${code(`curl -LO https://repo1.maven.org/maven2/org/apache/jena/apache-jena/6.2.0/apache-jena-6.2.0.zip
curl -LO https://repo1.maven.org/maven2/org/apache/jena/apache-jena-fuseki/6.2.0/apache-jena-fuseki-6.2.0.zip
unzip -q apache-jena-6.2.0.zip && unzip -q apache-jena-fuseki-6.2.0.zip
export PATH="$PWD/apache-jena-6.2.0/bin:$PATH"     # gives you riot, tdb2.*`)}
      <h3>Start a persistent dataset</h3>
      ${code(`apache-jena-fuseki-6.2.0/fuseki-server --loc=db --port 3030 /rare`)}
      <p>This creates a TDB2 database in <code>db/</code> and serves it as <code>/rare</code>. The query endpoint is <code>http://localhost:3030/rare/sparql</code>; the web UI is at <a href="http://localhost:3030" target="_blank">localhost:3030</a>. Fuseki sends CORS headers by default.</p>
      <h3>Loading files</h3>
      ${code(`# stop the server, then
tdb2.tdbloader --loc db data/*.nt`)}`,
    task: `Start Fuseki, enter its endpoint URL below and press <b>Connect</b>.`,
  },
  {
    id: "QLEV",
    title: "QLever",
    track: "ep",
    kind: "connect",
    concept: "Indexing and serving with QLever",
    prereqs: ["ENDP"],
    defaultUrl: "http://localhost:7019",
    story: `<p><a href="https://github.com/ad-freiburg/qlever" target="_blank">QLever</a>, from the University of Freiburg, builds a compressed index once and then answers queries over billions of triples in seconds. It powers public endpoints for Wikidata, OpenStreetMap, PubChem and UniProt.</p>`,
    lesson: `
      <p>QLever has no "insert file" step: you <b>index</b> a set of files, then <b>start</b> a server on that index. The <code>qlever</code> command-line tool drives both through Docker.</p>
      <h3>Install the control script</h3>
      ${code(`pip install qlever          # inside your virtual environment
qlever --version`)}
      <h3>Write a Qleverfile</h3>
      <p>Make a folder, put your <code>.nt</code> files in it, and add a file called <code>Qleverfile</code>:</p>
      ${code(`[data]
NAME        = rare
DESCRIPTION = ORDO, HOOM, HPO, OFCO and Orphanet functional consequences

[index]
INPUT_FILES     = *.nt
CAT_INPUT_FILES = cat \${INPUT_FILES}
SETTINGS_JSON   = { "num-triples-per-batch": 1000000 }

[server]
PORT               = 7019
ACCESS_TOKEN       = change_me
MEMORY_FOR_QUERIES = 4G

[runtime]
SYSTEM = docker
IMAGE  = adfreiburg/qlever:latest`)}
      ${code(`qlever index
qlever start
qlever ui        # optional: QLever's own editor with autocompletion`)}
      <p>The endpoint is <code>http://localhost:7019</code>, with CORS enabled. To add data later, run <code>qlever index --overwrite-existing</code> and <code>qlever start</code> again. QLever only reads Turtle, N-Triples and N-Quads, so convert RDF/XML first.</p>`,
    task: `Index at least one file, start QLever, enter its endpoint URL below and press <b>Connect</b>.`,
    hint: `An index needs some data. Any small <code>.nt</code> file works for now, for example OFCO converted with <code>riot --output=nt OFCO.owl &gt; ofco.nt</code>.`,
  },
  {
    id: "VIRT",
    title: "OpenLink Virtuoso",
    track: "ep",
    kind: "connect",
    concept: "Virtuoso, isql and CORS",
    prereqs: ["ENDP"],
    defaultUrl: "http://localhost:8890/sparql",
    story: `<p><a href="https://github.com/openlink/virtuoso-opensource" target="_blank">Virtuoso</a> is a SQL database that also stores RDF. It runs many of the large public endpoints you'll use later, including UniProt, DBpedia and RDF Portal.</p>`,
    lesson: `
      <h3>Start it</h3>
      ${code(`export DBA_PASSWORD=choose-a-password
docker run -d --name virtuoso -p 8890:8890 -p 1111:1111 \\
  -e DBA_PASSWORD="$DBA_PASSWORD" \\
  -e VIRT_Parameters_DirsAllowed=".,../vad,/usr/share/proj,/data" \\
  -v "$PWD/data":/data:ro \\
  openlink/virtuoso-opensource-7:7.2.17`)}
      <p>The endpoint is <code>http://localhost:8890/sparql</code>; the Conductor admin UI is at <a href="http://localhost:8890/conductor" target="_blank">localhost:8890/conductor</a>.</p>
      <h3>Turn on CORS</h3>
      <p>Virtuoso doesn't send CORS headers by default. Redefine the <code>/sparql</code> path with CORS enabled, through its SQL console <code>isql</code>:</p>
      ${code(`docker exec virtuoso isql 1111 dba "$DBA_PASSWORD" exec="
  DB.DBA.VHOST_REMOVE (lhost=>'*ini*', vhost=>'*ini*', lpath=>'/sparql');
  DB.DBA.VHOST_DEFINE (lhost=>'*ini*', vhost=>'*ini*', lpath=>'/sparql',
    ppath=>'/!sparql/', is_dav=>1, vsp_user=>'dba',
    opts=>vector('cors', '*', 'browse_sheet', '', 'noinherit', 'yes'));"`)}
      <h3>Loading files</h3>
      <p>The bulk loader registers files with <code>ld_dir</code> and loads them with <code>rdf_loader_run</code>:</p>
      ${code(`docker exec virtuoso isql 1111 dba "$DBA_PASSWORD" exec="
  ld_dir('/data', '*.nt', 'https://example.org/graph');
  rdf_loader_run(); checkpoint;"`)}
      <p>For federated queries (<code>SERVICE</code>) later on, allow the anonymous <code>SPARQL</code> user to call other endpoints:</p>
      ${code(`docker exec virtuoso isql 1111 dba "$DBA_PASSWORD" exec='
  GRANT SPARQL_LOAD_SERVICE_DATA TO "SPARQL";
  GRANT SPARQL_SPONGE TO "SPARQL";
  GRANT SELECT ON DB.DBA.SPARQL_SINV_2 TO "SPARQL";
  GRANT EXECUTE ON DB.DBA.SPARQL_SINV_IMP TO "SPARQL";'`)}
      <p>Only do this on a machine you control: it lets anyone who can reach your endpoint make it fetch from other servers.</p>`,
    task: `Start Virtuoso, enable CORS, enter its endpoint URL below and press <b>Connect</b>.`,
  },
  {
    id: "GRDB",
    title: "Ontotext GraphDB",
    track: "ep",
    kind: "connect",
    concept: "GraphDB repositories and the Workbench",
    prereqs: ["ENDP"],
    defaultUrl: "http://localhost:7200/repositories/rare",
    story: `<p><a href="https://graphdb.ontotext.com/" target="_blank">GraphDB</a> is a commercial triplestore with a free edition. It's known for its rule-based reasoning and its Workbench, a browser UI for importing, exploring and visualising data.</p>`,
    lesson: `
      <h3>Get a free licence</h3>
      <p>Since version 10, GraphDB Free needs a licence file. Request one through the <a href="https://graphdb.ontotext.com/" target="_blank">GraphDB Free download form</a>; it arrives by email. Save it as <code>graphdb.license</code>.</p>
      <h3>Start it</h3>
      ${code(`mkdir -p graphdb-import
docker run -d --name graphdb -p 7200:7200 \\
  -v "$PWD/graphdb.license":/opt/graphdb/home/conf/graphdb.license:ro \\
  -v "$PWD/graphdb-import":/opt/graphdb/home/graphdb-import \\
  -v graphdb:/opt/graphdb/home \\
  ontotext/graphdb:11.5.2 \\
  -Dgraphdb.workbench.cors.enable=true '-Dgraphdb.workbench.cors.origin=*'`)}
      <p>Open the Workbench at <a href="http://localhost:7200" target="_blank">localhost:7200</a>, choose <b>Setup → Repositories → Create new repository</b>, pick <i>GraphDB Repository</i>, name it <code>rare</code>, and set the ruleset to <b>No inference</b>. Inference would add derived triples and change your answers.</p>
      <p>The endpoint is <code>http://localhost:7200/repositories/rare</code>.</p>
      <h3>Loading files</h3>
      <p>Copy files into <code>graphdb-import/</code>, then use <b>Import → Server files</b> in the Workbench.</p>`,
    task: `Start GraphDB with a <code>rare</code> repository, enter its endpoint URL below and press <b>Connect</b>.`,
  },
  {
    id: "BLZG",
    title: "Blazegraph",
    track: "ep",
    kind: "connect",
    concept: "Blazegraph and a CORS proxy",
    prereqs: ["ENDP", "PYIN"],
    defaultUrl: "http://localhost:8899",
    story: `<p><a href="https://github.com/blazegraph/database" target="_blank">Blazegraph</a> served the Wikidata Query Service for a decade. Its last release was in 2019, which is exactly why Wikidata is moving to another engine. Many SPARQL tutorials still assume it, and its query hints and label service shaped how people write Wikidata queries.</p>`,
    lesson: `
      <h3>Start it</h3>
      ${code(`docker run -d --name blazegraph -p 9999:8080 -v "$PWD/data":/data:ro lyrasis/blazegraph:2.1.5`)}
      <p>The image is built for x86; on Apple Silicon it runs under emulation and is slower. The workbench is at <a href="http://localhost:9999/bigdata" target="_blank">localhost:9999/bigdata</a>, and the endpoint is <code>http://localhost:9999/bigdata/sparql</code>. The journal file grows to several gigabytes for this course's data, so check your free disk space.</p>
      <h3>CORS through a small proxy</h3>
      <p>Blazegraph's web app sends no CORS headers. Instead of patching its Jetty configuration, put <a href="${REPO}cors_proxy.py" target="_blank">cors_proxy.py</a> in front of it. It is 70 lines of standard-library Python:</p>
      ${code(`curl -LO ${RAW}cors_proxy.py
python cors_proxy.py http://localhost:9999/bigdata/sparql 8899`)}
      <p>Use <code>http://localhost:8899</code> as your endpoint in Scopoli. The same proxy works for any endpoint without CORS.</p>
      <h3>Loading files</h3>
      ${code(`curl -X POST --data-urlencode "update=LOAD <file:///data/example.nt>" \\
  http://localhost:9999/bigdata/sparql`)}`,
    task: `Start Blazegraph and the proxy, enter the proxy URL below and press <b>Connect</b>.`,
  },
  {
    id: "COMU",
    title: "Comunica",
    track: "ep",
    kind: "connect",
    concept: "A query engine over files and endpoints",
    prereqs: ["ENDP"],
    defaultUrl: "http://localhost:3000/sparql",
    story: `<p><a href="https://comunica.dev/" target="_blank">Comunica</a> is a query <i>engine</i>, not a database: it answers SPARQL by fetching from <b>sources</b> such as RDF files, other SPARQL endpoints and Linked Data documents, and combining the answers. That makes it a natural tool for federation, but slow for large local datasets.</p>`,
    lesson: `
      <h3>Install (Node.js 18+)</h3>
      ${code(`npm install -g @comunica/query-sparql-file@5.4.1`)}
      <h3>Query files directly</h3>
      ${code(`comunica-sparql-file data/ofco.nt "SELECT * WHERE { ?s ?p ?o } LIMIT 5"`)}
      <h3>Expose files as an endpoint</h3>
      ${code(`comunica-sparql-file-http data/ordo.nt data/ofco.nt -p 3000 -t 300`)}
      <p>The endpoint is <code>http://localhost:3000/sparql</code>, with CORS enabled. Comunica parses the files <b>on every query</b>: fine for OFCO and ORDO, but too slow for HOOM's 3.6 million triples. If you choose Comunica, add a database for the HOOM problems — or keep Comunica for federating several sources:</p>
      ${code(`npm install -g @comunica/query-sparql
comunica-sparql sparql@http://localhost:7878/query https://query.wikidata.org/sparql \\
  "SELECT * WHERE { ?s ?p ?o } LIMIT 5"`)}`,
    task: `Start Comunica's HTTP endpoint on at least one file, enter its URL below and press <b>Connect</b>.`,
  },

  // ------------------------------------------------------- Rare disease data
  {
    id: "DSRC",
    title: "Where the Data Lives",
    track: "dt",
    kind: "guide",
    concept: "Finding, licensing and preparing source data",
    prereqs: ["PYXM"],
    prereqsAny: STORE_IDS,
    story: `
      <p>About 1 in 17 people will have a rare disease in their lifetime, spread over more than 6,000 conditions. <a href="https://www.orpha.net" target="_blank">Orphanet</a>, run by INSERM in Paris, is the reference inventory. Its <b>ORPHAcodes</b> are the identifiers European reference networks and many national health systems use to record rare diseases. Orphanet publishes its knowledge as open data under <b>CC BY 4.0</b> on <a href="https://sciences.orphadata.com/" target="_blank">Orphadata</a>.</p>`,
    lesson: `
      <table class="mini">
        <tr><th>Source</th><th>What it holds</th><th>Where</th><th>Format</th></tr>
        <tr><td><b>ORDO</b> 4.9</td><td>Rare diseases, their classification, genes, prevalence, inheritance and cross-references (OMIM, ICD, MONDO, MeSH…)</td><td><a href="https://sciences.orphadata.com/ordo/" target="_blank">Orphadata</a>; also <a href="https://www.ebi.ac.uk/ols4/ontologies/ordo" target="_blank">EBI OLS</a> and <a href="https://bioportal.bioontology.org/ontologies/ORDO" target="_blank">BioPortal</a></td><td>OWL, RDF/XML</td></tr>
        <tr><td><b>HOOM</b> 2.6</td><td>Which HPO phenotypes occur in which disorder, how often, and with what evidence (HPO–ORDO Ontological Module)</td><td><a href="https://sciences.orphadata.com/hoom/" target="_blank">Orphadata</a>; <a href="https://bioportal.bioontology.org/ontologies/HOOM" target="_blank">BioPortal</a></td><td>OWL/XML in a zip</td></tr>
        <tr><td><b>HPO</b></td><td>Names and hierarchy of the phenotype terms HOOM points to</td><td><a href="https://hpo.jax.org/" target="_blank">hpo.jax.org</a>, PURL <code>http://purl.obolibrary.org/obo/hp.owl</code>; also OLS</td><td>OWL, RDF/XML</td></tr>
        <tr><td><b>OFCO</b> 0.1</td><td>Vocabulary of activity limitations and participation restrictions, mapped to the WHO ICF</td><td><a href="https://github.com/Orphanet/ofco-ontology" target="_blank">GitHub: Orphanet/ofco-ontology</a> (work in progress)</td><td>OWL, RDF/XML</td></tr>
        <tr><td><b>Functional consequences</b></td><td>Which limitations each disorder causes, with frequency, severity and onset</td><td><a href="https://sciences.orphadata.com/functional-consequences/" target="_blank">Orphadata</a></td><td>XML (not RDF!)</td></tr>
      </table>
      <h3>Three integration problems you have to solve</h3>
      <ol>
        <li><b>HOOM is OWL/XML</b>, a syntax for OWL tools, not RDF. Triplestores can't read it. Convert it with <a href="https://robot.obolibrary.org/" target="_blank">ROBOT</a>.</li>
        <li><b>Four HOOM IRIs contain <code>[</code> or <code>]</code></b>, which IRIs may not contain. Strict loaders (Oxigraph, QLever) reject the file, so percent-encode them.</li>
        <li><b>Functional consequences are XML</b>. Turn them into RDF that points at ORDO diseases and OFCO terms — the join you did in <a href="#/p/PYXM">PYXM</a>.</li>
      </ol>
      <h3>Build everything with one script</h3>
      <p><a href="${REPO}build.sh" target="_blank">build.sh</a> downloads the five sources, converts and cleans them, and runs <a href="${REPO}fc_to_rdf.py" target="_blank">fc_to_rdf.py</a>. It needs Java, Jena's <code>riot</code>, Python with rdflib, and about 2 GB of free disk space:</p>
      ${code(`curl -LO ${RAW}build.sh
curl -LO ${RAW}fc_to_rdf.py
bash build.sh`)}
      <p>You end up with <code>data/ordo.nt</code> (0.6 M triples), <code>hoom.nt</code> (3.6 M), <code>hp.nt</code> (0.9 M), <code>ofco.nt</code> and <code>fc.nt</code> (0.24 M). Read the script before running it — every step is something you could do by hand.</p>`,
    task: `Run <code>build.sh</code> (or do the steps yourself) so the five N-Triples files are ready, then mark this step as done.`,
  },
  {
    id: "LORD",
    title: "Load ORDO",
    track: "dt",
    endpoint: "local",
    needs: ["ordo"],
    concept: "Bulk loading; skos:notation",
    prereqs: ["DSRC"],
    story: `
      <p>Marfan syndrome is a connective-tissue disorder that affects the heart, eyes and skeleton. Its ORPHAcode is <b>558</b>. In ORDO every clinical entity is an OWL class with IRI <code>http://www.orpha.net/ORDO/Orphanet_&lt;code&gt;</code>, and carries its code as a string in <code>skos:notation</code>, for example <code>"ORPHA:558"</code>.</p>
      <h3>Load the data into your store</h3>
      <p>Load all five files now; the next problems use them. Pick your store:</p>
      ${LOAD_TABLE}`,
    lesson: `<p>Looking an entity up by its <i>code</i> instead of its IRI is the usual first step when someone gives you an ORPHAcode.</p>`,
    task: `Return the ORDO class whose <code>skos:notation</code> is <code>"ORPHA:558"</code>, with its <code>rdfs:label</code>.`,
    returns: ["disease", "label"],
    sample: `disease, label\nhttp://www.orpha.net/ORDO/Orphanet_558, Marfan syndrome`,
    hint: `<code>?disease skos:notation "ORPHA:558" ; rdfs:label ?label .</code>`,
    starter: RD_PREFIXES + `
SELECT ?disease ?label WHERE {

}`,
    solution: RD_PREFIXES + `
SELECT ?disease ?label WHERE {
  ?disease skos:notation "ORPHA:558" ;
           rdfs:label ?label .
}`,
    check: ["disease"],
    explain: `If you loaded HOOM too, you got <b>two</b> labels: "Marfan syndrome" from ORDO and "ORPHA:558" from HOOM, which labels every disease with its code. Integrated data means overlapping statements, and you'll filter these in later problems.`,
  },
  {
    id: "LHOO",
    title: "Phenotypes as OWL",
    track: "dt",
    endpoint: "local",
    needs: ["hoom"],
    concept: "OBAN associations, RDF lists, COUNT",
    prereqs: ["LORD"],
    story: `
      <p>HOOM tells you which clinical signs occur in a disorder — for Marfan syndrome, arachnodactyly (long fingers), lens dislocation, aortic dilatation — using terms from the Human Phenotype Ontology (HPO). Each disorder–phenotype pair is an <b>association class</b> following the <a href="https://github.com/EBISPOT/OBAN" target="_blank">OBAN</a> model. The class is defined as the intersection of OWL restrictions:</p>
      ${code(`hoom:Orpha:558_HP:0001166_Freq:VF  owl:equivalentClass [
  owl:intersectionOf (
    [ owl:onProperty oban:association_has_subject ; owl:someValuesFrom ordo:Orphanet_558 ]
    [ owl:onProperty oban:association_has_object  ; owl:someValuesFrom obo:HP_0001166 ]
    [ owl:onProperty hoom:has_frequency           ; owl:someValuesFrom hoom:VeryFrequent ]
    …
  )
] .`)}
      <p>The parentheses are an <b>RDF list</b>: a chain of blank nodes linked by <code>rdf:first</code> (the item) and <code>rdf:rest</code> (the next link).</p>`,
    lesson: `<p>The path <code>owl:equivalentClass/owl:intersectionOf/rdf:rest*/rdf:first</code> reaches every member of the list, wherever it sits. Then match the restriction's two properties.</p>`,
    task: `Count the HOOM association classes whose subject is Marfan syndrome (<code>ordo:Orphanet_558</code>). Return the count as <code>?associations</code>.`,
    returns: ["associations"],
    sample: `associations\n6…`,
    hint: `Bind the restriction with the path, then <code>?r owl:onProperty oban:association_has_subject ; owl:someValuesFrom ordo:Orphanet_558</code>.`,
    starter: RD_PREFIXES + `
SELECT (COUNT(DISTINCT ?assoc) AS ?associations) WHERE {

}`,
    solution: RD_PREFIXES + `
SELECT (COUNT(DISTINCT ?assoc) AS ?associations) WHERE {
  ?assoc owl:equivalentClass/owl:intersectionOf/rdf:rest*/rdf:first ?r .
  ?r owl:onProperty oban:association_has_subject ;
     owl:someValuesFrom ordo:Orphanet_558 .
}`,
    check: ["associations"],
    explain: `Each association is one phenotype annotation, with its frequency and source. OWL modelling makes the data reasoner-friendly, but it takes several hops in SPARQL to reach a simple fact.`,
  },
  {
    id: "LHPO",
    title: "Names for Phenotypes",
    track: "dt",
    endpoint: "local",
    needs: ["hpo", "hoom"],
    concept: "Integrating a second ontology; FILTER on strings",
    prereqs: ["LHOO"],
    story: `
      <p>HOOM refers to phenotypes only by IRI (<code>obo:HP_0001166</code>) and labels them with their ID: <code>"HP:0001166"</code>. The names live in HPO itself, which you loaded as <code>hp.nt</code>. Now <code>obo:HP_0001166</code> has two labels.</p>`,
    lesson: `
      <p>When sources disagree about a property, decide which one you trust and filter the others out:</p>
      ${code(`FILTER(!STRSTARTS(?label, "HP:"))`)}
      <p>Alternatively, restrict to statements from one source with named graphs — which only works if you loaded each file into its own graph.</p>`,
    task: `Return the human-readable label of <code>obo:HP_0001166</code> only — not the <code>HP:…</code> code that HOOM adds.`,
    returns: ["label"],
    sample: `label\nArachnodactyly`,
    hint: `Get all labels first, then add the FILTER.`,
    starter: RD_PREFIXES + `
SELECT ?label WHERE {

}`,
    solution: RD_PREFIXES + `
SELECT ?label WHERE {
  obo:HP_0001166 rdfs:label ?label .
  FILTER(!STRSTARTS(?label, "HP:"))
}`,
    check: ["label"],
    explain: `Arachnodactyly, "spider fingers", is a hallmark of Marfan syndrome. The same trick, <code>FILTER(!STRSTARTS(?name, "ORPHA:"))</code>, cleans disease labels.`,
  },
  {
    id: "LOFC",
    title: "The Shape of OFCO",
    track: "dt",
    endpoint: "local",
    needs: ["ofco"],
    concept: "Exploring a class hierarchy",
    prereqs: ["LORD"],
    story: `
      <p>OFCO's root is <code>ofco:ActivitiesAndParticipation</code> ("Activity limitation and participation restriction"). Below it sit broad domains such as moving around, self-care and social life, then specific activities. Knowing the top of a hierarchy is how you start using an ontology you haven't seen before.</p>`,
    lesson: `<p>Direct subclasses are one <code>rdfs:subClassOf</code> hop away. Add <code>*</code> or <code>+</code> to go deeper.</p>`,
    task: `List the direct subclasses of <code>ofco:ActivitiesAndParticipation</code> with their labels.`,
    returns: ["term", "label"],
    sample: `term, label\nhttps://w3id.org/ofco/MovingAround, Moving around`,
    hint: `<code>?term rdfs:subClassOf ofco:ActivitiesAndParticipation ; rdfs:label ?label</code>.`,
    starter: RD_PREFIXES + `
SELECT ?term ?label WHERE {

}`,
    solution: RD_PREFIXES + `
SELECT ?term ?label WHERE {
  ?term rdfs:subClassOf ofco:ActivitiesAndParticipation ;
        rdfs:label ?label .
}`,
    check: ["term"],
    explain: `Ten domains, from <i>Understanding</i> to <i>Temperament and behaviour</i>. Cognition, sleep and behaviour are Orphanet additions to the ICF, because many rare diseases affect them.`,
  },
  {
    id: "FCXM",
    title: "Your Own RDF",
    track: "dt",
    endpoint: "local",
    needs: ["fc", "ofco"],
    concept: "Designing triples for converted data",
    prereqs: ["LOFC", "PYXM"],
    story: `
      <p><a href="${REPO}fc_to_rdf.py" target="_blank">fc_to_rdf.py</a> turned Orphanet's XML into RDF with a small vocabulary of its own (prefix <code>fc: &lt;https://koetai.github.io/scopoli/vocab#&gt;</code>). Each association looks like this:</p>
      ${code(`<…/fc/association/190175> a fc:FunctionalConsequence ;
    fc:disorder    ordo:Orphanet_893 ;           # → ORDO
    fc:limitation  ofco:CaringForBodyParts ;     # → OFCO
    fc:frequency   "Very frequent" ;
    fc:temporality "Acquisition delay" ;
    fc:severity    "Low" ;
    fc:lossOfAbility false .`)}
      <p>Linking happens by reusing the <b>existing IRIs</b> of ORDO and OFCO; no new identifiers are invented for diseases or limitations.</p>`,
    lesson: `<p>Read the script: it's about 80 lines, and the pattern — parse, look up an identifier mapping, emit triples that reuse existing IRIs — applies to almost any XML or CSV source.</p>`,
    task: `For Marfan syndrome (<code>ordo:Orphanet_558</code>), return each recorded limitation and its frequency.`,
    returns: ["limitation", "frequency"],
    sample: `limitation, frequency\nhttps://w3id.org/ofco/WalkingLongDistances, Frequent`,
    hint: `Start from <code>?a fc:disorder ordo:Orphanet_558</code>.`,
    starter: RD_PREFIXES + `
SELECT ?limitation ?frequency WHERE {

}`,
    solution: RD_PREFIXES + `
SELECT ?limitation ?frequency WHERE {
  ?a fc:disorder ordo:Orphanet_558 ;
     fc:limitation ?limitation ;
     fc:frequency ?frequency .
}`,
    check: ["limitation", "frequency"],
    explain: `The same limitation can appear more than once with different frequencies — for example for different ages of onset. Add <code>?a fc:temporality ?t</code> to see why.`,
  },
  {
    id: "INTG",
    title: "Five Sources, One Question",
    track: "dt",
    endpoint: "local",
    needs: ["hoom", "fc", "ordo"],
    concept: "Integration query across ORDO, HOOM, HPO, OFCO and fc",
    prereqs: ["FCXM", "LHPO"],
    story: `
      <p>A speech therapist asks: <i>in which rare disorders is intellectual disability (HPO <code>HP:0001249</code>) very frequent, and has Orphanet also recorded a limitation in <b>acquiring language</b>?</i> No single source can answer this. HOOM knows the phenotypes, the functional-consequence data knows the limitations, and ORDO knows the names.</p>`,
    lesson: `
      <p>To match several members of the <i>same</i> RDF list, bind the list once and walk into it repeatedly:</p>
      ${code(`?assoc owl:equivalentClass/owl:intersectionOf ?list .
?list rdf:rest*/rdf:first [ owl:onProperty A ; owl:someValuesFrom ?x ] .
?list rdf:rest*/rdf:first [ owl:onProperty B ; owl:someValuesFrom ?y ] .`)}
      <p><code>[ … ]</code> is an anonymous node written inline, a blank node in query form.</p>`,
    task: `Return the disorders (with ORDO names, not <code>ORPHA:</code> codes) where HOOM says <code>obo:HP_0001249</code> is <code>hoom:VeryFrequent</code> <b>and</b> the functional-consequence data has <code>ofco:AcquiringLanguage</code>.`,
    returns: ["disease", "name"],
    sample: `disease, name\nhttp://www.orpha.net/ORDO/Orphanet_870, Down syndrome`,
    hint: `Three list members (subject, object, frequency), then <code>?fc fc:disorder ?disease ; fc:limitation ofco:AcquiringLanguage</code>, then the name with a FILTER.`,
    starter: RD_PREFIXES + `
SELECT DISTINCT ?disease ?name WHERE {
  ?assoc owl:equivalentClass/owl:intersectionOf ?list .

}`,
    solution: RD_PREFIXES + `
SELECT DISTINCT ?disease ?name WHERE {
  ?assoc owl:equivalentClass/owl:intersectionOf ?list .
  ?list rdf:rest*/rdf:first [ owl:onProperty oban:association_has_object ;
                              owl:someValuesFrom obo:HP_0001249 ] .
  ?list rdf:rest*/rdf:first [ owl:onProperty oban:association_has_subject ;
                              owl:someValuesFrom ?disease ] .
  ?list rdf:rest*/rdf:first [ owl:onProperty hoom:has_frequency ;
                              owl:someValuesFrom hoom:VeryFrequent ] .
  ?fc fc:disorder ?disease ;
      fc:limitation ofco:AcquiringLanguage .
  ?disease rdfs:label ?name .
  FILTER(!STRSTARTS(?name, "ORPHA:"))
}`,
    check: ["disease"],
    explain: `About thirty disorders, including Down syndrome and Kabuki syndrome. This is data integration: the sources share no database, only IRIs, and the query is the join.`,
  },

  // --------------------------------------------------- Rare disease queries
  {
    id: "RDXR",
    title: "Crosswalks",
    track: "rd",
    endpoint: "local",
    needs: ["ordo"],
    concept: "STRSTARTS, STRAFTER",
    prereqs: ["LORD"],
    story: `
      <p>A clinical geneticist has an OMIM number, a coder has an ICD-10 code and a researcher has a MONDO ID. ORDO records cross-references as plain strings in <code>oboInOwl:hasDbXref</code>, for example <code>"OMIM:219700"</code> or <code>"ICD-10:E84.9"</code>. Cystic fibrosis is <code>ordo:Orphanet_586</code>.</p>`,
    lesson: `
      ${code(`FILTER(STRSTARTS(?xref, "MONDO:"))
BIND(STRAFTER(?xref, ":") AS ?id)`)}`,
    task: `Return the OMIM cross-references of cystic fibrosis as <code>?omim</code>, <b>without</b> the <code>OMIM:</code> prefix.`,
    returns: ["omim"],
    sample: `omim\n219700`,
    hint: `Filter the xrefs with STRSTARTS, then BIND the part after the colon.`,
    starter: RD_PREFIXES + `
SELECT ?omim WHERE {

}`,
    solution: RD_PREFIXES + `
SELECT ?omim WHERE {
  ordo:Orphanet_586 oboInOwl:hasDbXref ?xref .
  FILTER(STRSTARTS(?xref, "OMIM:"))
  BIND(STRAFTER(?xref, "OMIM:") AS ?omim)
}`,
    check: ["omim"],
    explain: `Cross-references stored as strings are easy to read but can't be followed as links. Building IRIs from them with <code>IRI(CONCAT(…))</code> is how you join to other graphs, as you'll do with Wikidata in RDWD.`,
  },
  {
    id: "RDGN",
    title: "Genes Behind Cystic Fibrosis",
    track: "rd",
    endpoint: "local",
    needs: ["ordo"],
    concept: "OWL restrictions as data",
    prereqs: ["RDXR"],
    story: `
      <p>ORDO also contains <b>genes</b>, as classes with an HGNC symbol in <code>ordo:symbol</code>. A gene's link to a disease is written as an OWL restriction on the gene:</p>
      ${code(`ordo:Orphanet_119382 ordo:symbol "CFTR" ;
  rdfs:subClassOf [ owl:onProperty ordo:Orphanet_410295 ;   # "disease-causing germline
                    owl:someValuesFrom ordo:Orphanet_586 ] .  #  mutation(s) (loss of function) in"`)}
      <p>The property itself has a label, so the <i>type</i> of relation is queryable too: disease-causing, modifying, candidate gene, and so on.</p>`,
    lesson: `<p>A blank node is matched like any other node — you just can't name it in the result. Give it a variable such as <code>?r</code> and keep walking.</p>`,
    task: `For cystic fibrosis, return every associated gene symbol and the label of the relation.`,
    returns: ["symbol", "relation"],
    sample: `symbol, relation\nCFTR, disease-causing germline mutation(s) (loss of function) in\nTGFB1, modifying germline mutation in`,
    hint: `<code>?gene rdfs:subClassOf ?r . ?r owl:onProperty ?p ; owl:someValuesFrom ordo:Orphanet_586 . ?p rdfs:label ?relation</code>.`,
    starter: RD_PREFIXES + `
SELECT ?symbol ?relation WHERE {

}`,
    solution: RD_PREFIXES + `
SELECT ?symbol ?relation WHERE {
  ?gene rdfs:subClassOf ?r ;
        ordo:symbol ?symbol .
  ?r owl:onProperty ?p ;
     owl:someValuesFrom ordo:Orphanet_586 .
  ?p rdfs:label ?relation .
}`,
    check: ["symbol", "relation"],
    explain: `One disease-causing gene (CFTR) and many <i>modifier</i> genes, which influence how severe the lung disease becomes. That is clinically important nuance, and you'd lose it if you only stored "gene associated with disease".`,
  },
  {
    id: "RDHI",
    title: "Marfan and Friends",
    track: "rd",
    endpoint: "local",
    needs: ["ordo"],
    concept: "Transitive paths through restrictions",
    prereqs: ["RDGN"],
    story: `
      <p>Orphanet classifies diseases in groups with <code>part_of</code> restrictions (<code>obo:BFO_0000050</code>), not plain <code>rdfs:subClassOf</code>. The group "Marfan syndrome and Marfan-related disorders" is <code>ordo:Orphanet_284993</code>. Marfan syndrome itself has subtypes (type 1, type 2), each <code>part_of</code> its parent.</p>`,
    lesson: `
      <p>Repeat a two-step path with <code>+</code>:</p>
      ${code(`?x (rdfs:subClassOf/owl:someValuesFrom)+ ?group`)}
      <p>But beware: gene-to-disease links have the <i>same shape</i>. Keep only clinical entities, which in ORDO sit under <code>ordo:Orphanet_C001</code> ("clinical entity") through their type class:</p>
      ${code(`?x rdfs:subClassOf/rdfs:subClassOf ordo:Orphanet_C001 .`)}`,
    task: `Return every <b>clinical entity</b> (not gene) below <code>ordo:Orphanet_284993</code> at any depth.`,
    returns: ["disorder"],
    sample: `disorder\nhttp://www.orpha.net/ORDO/Orphanet_558\nhttp://www.orpha.net/ORDO/Orphanet_284963`,
    hint: `Run it once without the second triple: you'll see "fibrillin 1" and other genes appear.`,
    starter: RD_PREFIXES + `
SELECT DISTINCT ?disorder WHERE {

}`,
    solution: RD_PREFIXES + `
SELECT DISTINCT ?disorder WHERE {
  ?disorder (rdfs:subClassOf/owl:someValuesFrom)+ ordo:Orphanet_284993 ;
            rdfs:subClassOf/rdfs:subClassOf ordo:Orphanet_C001 .
}`,
    check: ["disorder"],
    explain: `A dozen clinical entities, against 40-odd nodes in the naive version. Knowing the modelling conventions of a source matters as much as knowing SPARQL.`,
  },
  {
    id: "RDPH",
    title: "The Marfan Phenotype",
    track: "rd",
    endpoint: "local",
    needs: ["hoom", "hpo"],
    concept: "Joining list members; labels from two sources",
    prereqs: ["RDHI", "INTG"],
    story: `
      <p>A cardiologist preparing a clinic letter wants the full list of Marfan features with how often each occurs. HOOM uses Orphanet's frequency classes, such as <code>hoom:VeryFrequent</code> and <code>hoom:Occasional</code>. Each has a short <code>rdfs:label</code> ("VeryFrequent") and an <code>rdfs:comment</code> with the range ("present in 80 to 99% of cases").</p>`,
    lesson: `<p>You've seen every piece already: walk the intersection list three times, then fetch labels and filter HOOM's code labels.</p>`,
    task: `For Marfan syndrome, return each HPO phenotype, its HPO label (not the <code>HP:</code> code) and the label of its frequency class.`,
    returns: ["phenotype", "label", "frequency"],
    sample: `phenotype, label, frequency\nhttp://purl.obolibrary.org/obo/HP_0001166, Arachnodactyly, VeryFrequent`,
    hint: `Third list member: <code>[ owl:onProperty hoom:has_frequency ; owl:someValuesFrom ?f ]</code>, then <code>?f rdfs:label ?frequency</code>.`,
    starter: RD_PREFIXES + `
SELECT ?phenotype ?label ?frequency WHERE {
  ?assoc owl:equivalentClass/owl:intersectionOf ?list .

}`,
    solution: RD_PREFIXES + `
SELECT ?phenotype ?label ?frequency WHERE {
  ?assoc owl:equivalentClass/owl:intersectionOf ?list .
  ?list rdf:rest*/rdf:first [ owl:onProperty oban:association_has_subject ;
                              owl:someValuesFrom ordo:Orphanet_558 ] .
  ?list rdf:rest*/rdf:first [ owl:onProperty oban:association_has_object ;
                              owl:someValuesFrom ?phenotype ] .
  ?list rdf:rest*/rdf:first [ owl:onProperty hoom:has_frequency ;
                              owl:someValuesFrom ?f ] .
  ?f rdfs:label ?frequency .
  ?phenotype rdfs:label ?label .
  FILTER(!STRSTARTS(?label, "HP:"))
}`,
    check: ["phenotype", "frequency"],
    explain: `Sort it with <code>ORDER BY ?frequency</code> and you have the start of a diagnostic checklist. HPO-based phenotype lists like this feed rare-disease diagnosis tools such as Exomiser.`,
  },
  {
    id: "RDCT",
    title: "The Most Described Disorders",
    track: "rd",
    endpoint: "local",
    needs: ["hoom"],
    concept: "GROUP BY over a large graph",
    prereqs: ["RDPH"],
    story: `<p>Some disorders have a few phenotype annotations, others over a hundred. Which have the richest phenotype descriptions in HOOM?</p>`,
    lesson: `<p>Aggregating over all of HOOM touches millions of triples. Watch how long your store takes, and compare with a classmate who chose a different store.</p>`,
    task: `Return the 10 disorders with the most distinct HPO phenotypes in HOOM, as <code>?disease</code> and <code>?phenotypes</code>, largest first.`,
    returns: ["disease", "phenotypes"],
    sample: `disease, phenotypes\nhttp://www.orpha.net/ORDO/Orphanet_904, 1…`,
    hint: `Two list members (subject and object), GROUP BY ?disease, ORDER BY DESC, LIMIT 10.`,
    starter: RD_PREFIXES + `
SELECT ?disease (COUNT(DISTINCT ?phenotype) AS ?phenotypes) WHERE {

}
`,
    solution: RD_PREFIXES + `
SELECT ?disease (COUNT(DISTINCT ?phenotype) AS ?phenotypes) WHERE {
  ?assoc owl:equivalentClass/owl:intersectionOf ?list .
  ?list rdf:rest*/rdf:first [ owl:onProperty oban:association_has_subject ;
                              owl:someValuesFrom ?disease ] .
  ?list rdf:rest*/rdf:first [ owl:onProperty oban:association_has_object ;
                              owl:someValuesFrom ?phenotype ] .
}
GROUP BY ?disease
ORDER BY DESC(?phenotypes)
LIMIT 10`,
    check: ["disease", "phenotypes"],
    explain: `Williams syndrome (ORPHA:904) tops the list: multisystem syndromes accumulate long phenotype lists. Add the names with a join on <code>rdfs:label</code> to see the rest.`,
  },
  {
    id: "RDFQ",
    title: "Everyday Life",
    track: "rd",
    endpoint: "local",
    needs: ["fc", "ofco"],
    concept: "Aggregates with labels",
    prereqs: ["RDCT", "FCXM"],
    story: `<p>Patient organisations argue that rare diseases should be judged by their impact on daily life, not only by their symptoms. Which activities are most often <i>very frequently</i> limited across rare disorders?</p>`,
    lesson: `<p>When you GROUP BY, every non-aggregated variable in SELECT must also be in GROUP BY — including a label you join in.</p>`,
    task: `Return the 10 OFCO limitations recorded as <code>"Very frequent"</code> in the most disorders: <code>?limitation</code>, its <code>?label</code> and the count <code>?disorders</code>, largest first.`,
    returns: ["limitation", "label", "disorders"],
    sample: `limitation, label, disorders\nhttps://w3id.org/ofco/PracticingSports, Practising sports, 1…`,
    hint: `<code>GROUP BY ?limitation ?label</code>.`,
    starter: RD_PREFIXES + `
SELECT ?limitation ?label (COUNT(DISTINCT ?disorder) AS ?disorders) WHERE {

}
`,
    solution: RD_PREFIXES + `
SELECT ?limitation ?label (COUNT(DISTINCT ?disorder) AS ?disorders) WHERE {
  ?a fc:limitation ?limitation ;
     fc:frequency "Very frequent" ;
     fc:disorder ?disorder .
  ?limitation rdfs:label ?label .
}
GROUP BY ?limitation ?label
ORDER BY DESC(?disorders)
LIMIT 10`,
    check: ["limitation", "disorders"],
    explain: `Sport, driving, paid work, travel: the limitations most often reported concern participation in society more than basic self-care.`,
  },
  {
    id: "RDNX",
    title: "Gaps Between Sources",
    track: "rd",
    endpoint: "local",
    needs: ["fc", "hoom"],
    concept: "MINUS vs FILTER NOT EXISTS; performance",
    prereqs: ["RDFQ"],
    story: `<p>Integration also reveals what is <i>missing</i>. Which disorders have functional-consequence data but no phenotype annotation at all in HOOM?</p>`,
    lesson: `
      <p>Both remove rows, but they're evaluated differently:</p>
      ${code(`FILTER NOT EXISTS { pattern using ?x }   # re-checked for every row
MINUS { pattern using ?x }               # computed once, then subtracted`)}
      <p>On a large pattern, <code>FILTER NOT EXISTS</code> can be very slow. On Oxigraph this question takes minutes that way and under a second with <code>MINUS</code>. Their results differ only when the inner pattern shares no variables with the outer one.</p>`,
    task: `Return the distinct disorders that appear in <code>fc:disorder</code> but never as the <code>owl:someValuesFrom</code> of an <code>oban:association_has_subject</code> restriction.`,
    returns: ["disorder"],
    sample: `disorder\nhttp://www.orpha.net/ORDO/Orphanet_…`,
    hint: `<code>MINUS { ?r owl:onProperty oban:association_has_subject ; owl:someValuesFrom ?disorder }</code>`,
    starter: RD_PREFIXES + `
SELECT DISTINCT ?disorder WHERE {

}`,
    solution: RD_PREFIXES + `
SELECT DISTINCT ?disorder WHERE {
  ?a fc:disorder ?disorder .
  MINUS { ?r owl:onProperty oban:association_has_subject ;
             owl:someValuesFrom ?disorder }
}`,
    check: ["disorder"],
    explain: `About a hundred disorders, mostly groups and subtypes. Orphanet annotates phenotypes at a different level than functional consequences. A list like this is useful feedback to curators.`,
  },
  {
    id: "RDWD",
    title: "Out Into the World",
    track: "rd",
    endpoint: "local",
    needs: ["ordo"],
    concept: "SERVICE from your own endpoint to Wikidata",
    prereqs: ["RDNX"],
    story: `
      <p>Your local graph is complete for Orphanet, but knows nothing else: no drugs, no proteins, no literature. Wikidata stores ORPHAcodes in property <a href="https://www.wikidata.org/wiki/Property:P1550" target="_blank">P1550</a> (<i>Orphanet ID</i>) as plain strings like <code>"558"</code>. From here on you'll query public endpoints, and this problem builds the bridge.</p>`,
    lesson: `
      <p>Your store can forward part of a query to Wikidata with <code>SERVICE</code>:</p>
      ${code(`BIND(STRAFTER(STR(?disorder), "Orphanet_") AS ?code)
SERVICE <https://query.wikidata.org/sparql> { ?item wdt:P1550 ?code }`)}
      <p>Your store sends the bindings it has so far to Wikidata. Wrap the local part in a <b>sub-select</b> that returns only the variables the remote side needs. That keeps the request small, and it keeps blank nodes such as <code>?r</code> out of it — some engines (Comunica, for one) would otherwise send them and Wikidata would reject the request.</p>
      ${code(`{ SELECT ?disorder ?code WHERE { … local pattern … } }
SERVICE <https://query.wikidata.org/sparql> { ?item wdt:P1550 ?code }`)}
      <p>Oxigraph, Fuseki, QLever, GraphDB, Blazegraph and Comunica federate out of the box. Virtuoso needs the <code>GRANT</code>s from <a href="#/p/VIRT">VIRT</a>.</p>`,
    task: `For every disorder directly <code>part_of</code> <code>ordo:Orphanet_284993</code>, find the Wikidata item(s) with that Orphanet ID.`,
    returns: ["disorder", "item"],
    sample: `disorder, item\nhttp://www.orpha.net/ORDO/Orphanet_558, http://www.wikidata.org/entity/Q208562`,
    hint: `Direct part_of: <code>?disorder rdfs:subClassOf ?r . ?r owl:onProperty obo:BFO_0000050 ; owl:someValuesFrom ordo:Orphanet_284993</code>.`,
    starter: RD_PREFIXES + `PREFIX wdt: <http://www.wikidata.org/prop/direct/>

SELECT ?disorder ?item WHERE {

}`,
    solution: RD_PREFIXES + `PREFIX wdt: <http://www.wikidata.org/prop/direct/>

SELECT ?disorder ?item WHERE {
  {
    SELECT ?disorder ?code WHERE {
      ?disorder rdfs:subClassOf ?r .
      ?r owl:onProperty obo:BFO_0000050 ;
         owl:someValuesFrom ordo:Orphanet_284993 .
      BIND(STRAFTER(STR(?disorder), "Orphanet_") AS ?code)
    }
  }
  SERVICE <https://query.wikidata.org/sparql> {
    ?item wdt:P1550 ?code .
  }
}`,
    check: ["disorder", "item"],
    explain: `Some ORPHAcodes match <i>two</i> Wikidata items, for example a disease and a separate item for its subtype or a duplicate. Mappings are rarely one-to-one. Next stop: Wikidata itself.`,
  },
];

PROBLEMS.unshift(...LOCAL_PROBLEMS);
// The public-endpoint chapters now follow the rare-disease chapter.
PROBLEMS.find((p) => p.id === "TRPL").prereqs = ["RDWD"];
