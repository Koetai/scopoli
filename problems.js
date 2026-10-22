// Problem catalogue. Each problem is checked by running `solution` on the same
// endpoint and comparing the set of values in the `check` columns, so answers
// stay valid as the underlying knowledge graphs evolve.

const ENDPOINTS = {
  wikidata: {
    name: "Wikidata Query Service",
    url: "https://query.wikidata.org/sparql",
    ui: (q) => "https://query.wikidata.org/#" + encodeURIComponent(q),
    home: "https://query.wikidata.org/",
  },
  uniprot: {
    name: "UniProt (SIB)",
    url: "https://sparql.uniprot.org/sparql",
    ui: (q) => "https://sparql.uniprot.org/sparql?query=" + encodeURIComponent(q),
    home: "https://sparql.uniprot.org/",
  },
  rdfportal_ebi: {
    name: "RDF Portal · EBI (ChEMBL, Ensembl, Reactome…)",
    url: "https://rdfportal.org/ebi/sparql",
    ui: (q) => "https://rdfportal.org/ebi/sparql?query=" + encodeURIComponent(q),
    home: "https://rdfportal.org/",
  },
  rdfportal_ncbi: {
    name: "RDF Portal · NCBI (MeSH, ClinVar, PubMed…)",
    url: "https://rdfportal.org/ncbi/sparql",
    ui: (q) => "https://rdfportal.org/ncbi/sparql?query=" + encodeURIComponent(q),
    home: "https://rdfportal.org/",
  },
};

const TRACKS = {
  wd: { name: "Wikidata", color: "var(--t-wd)" },
  sib: { name: "UniProt & SIB", color: "var(--t-sib)" },
  rp: { name: "RDF Portal", color: "var(--t-rp)" },
};

const WD_PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
`;

const UP_PREFIXES = `PREFIX up: <http://purl.uniprot.org/core/>
PREFIX taxon: <http://purl.uniprot.org/taxonomy/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX obo: <http://purl.obolibrary.org/obo/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`;

const PROBLEMS = [
  // ---------------------------------------------------------------- Wikidata
  {
    id: "TRPL",
    title: "Finding a Gene",
    track: "wd",
    endpoint: "wikidata",
    concept: "Triple patterns",
    prereqs: [],
    story: `
      <p>In 1994 the gene <b>BRCA1</b> was cloned and shown to carry inherited mutations that sharply raise the risk of breast and ovarian cancer. Today it is one of the most tested genes in clinical genetics.</p>
      <p>Before you can ask anything <i>about</i> BRCA1 in a knowledge graph, you must find the node that represents it. In Wikidata every thing is an <i>item</i> with an identifier like <code>Q42</code>, and facts are stored as <b>triples</b>: <i>subject – predicate – object</i>. Human genes carry their official HGNC symbol through property <a href="https://www.wikidata.org/wiki/Property:P353" target="_blank">P353</a> (<i>HGNC gene symbol</i>).</p>`,
    lesson: `
      <p>A SPARQL query is a <b>pattern</b> of triples where some positions are <b>variables</b> (starting with <code>?</code>). The engine returns every binding of the variables that makes the pattern match the data.</p>
<pre>SELECT ?item WHERE {
  ?item wdt:P231 "50-78-2" .   # CAS registry number of aspirin
}</pre>
      <p><code>wdt:</code> is a <i>prefix</i> abbreviating <code>&lt;http://www.wikidata.org/prop/direct/&gt;</code>. Strings are written in double quotes; the dot ends the triple.</p>`,
    task: `Find the Wikidata item for the human gene with HGNC symbol <code>BRCA1</code>.`,
    returns: ["gene"],
    sample: `gene\nhttp://www.wikidata.org/entity/Q…`,
    hint: `Put the variable <code>?gene</code> in the subject position, <code>wdt:P353</code> as predicate and the string <code>"BRCA1"</code> as object.`,
    starter: WD_PREFIXES + `
SELECT ?gene WHERE {

}`,
    solution: WD_PREFIXES + `
SELECT ?gene WHERE {
  ?gene wdt:P353 "BRCA1" .
}`,
    check: ["gene"],
    explain: `One triple pattern, one variable. The result is the IRI of the BRCA1 gene item. Note that the <i>gene</i> and the <i>protein</i> it encodes are separate items in Wikidata — that distinction matters in later problems.`,
  },
  {
    id: "LABL",
    title: "Naming a Gene",
    track: "wd",
    endpoint: "wikidata",
    concept: "Basic graph patterns, language tags",
    prereqs: ["TRPL"],
    story: `
      <p>Cystic fibrosis is caused by mutations in <b>CFTR</b>, a chloride channel in the membranes of lung, pancreas and sweat-gland cells. Clinical labs, NCBI and Ensembl all refer to the gene by different identifiers, and a knowledge graph is where these identifiers meet.</p>
      <p>The NCBI Gene (Entrez) identifier is stored via <a href="https://www.wikidata.org/wiki/Property:P351" target="_blank">P351</a>. Human-readable names are stored as <code>rdfs:label</code>, one per language, each tagged like <code>"…"@en</code>.</p>`,
    lesson: `
      <p>Several triple patterns that share a variable form a <b>basic graph pattern</b> — all of them must match at the same time. A semicolon repeats the subject:</p>
<pre>SELECT ?item ?name ?cas WHERE {
  ?item wdt:P231 "50-78-2" ;
        rdfs:label ?name ;
        wdt:P231 ?cas .
  FILTER(LANG(?name) = "nl")
}</pre>
      <p><code>FILTER</code> removes rows for which the condition is false; <code>LANG()</code> returns a literal's language tag.</p>`,
    task: `For the gene with HGNC symbol <code>CFTR</code>, return the item, its <b>English</b> label and its NCBI Gene ID.`,
    returns: ["gene", "label", "entrez"],
    sample: `gene, label, entrez\nhttp://www.wikidata.org/entity/Q…, CFTR, 1…`,
    hint: `Without the language filter you get one row per language Wikidata knows a label in.`,
    starter: WD_PREFIXES + `
SELECT ?gene ?label ?entrez WHERE {

}`,
    solution: WD_PREFIXES + `
SELECT ?gene ?label ?entrez WHERE {
  ?gene wdt:P353 "CFTR" ;
        rdfs:label ?label ;
        wdt:P351 ?entrez .
  FILTER(LANG(?label) = "en")
}`,
    check: ["gene", "label", "entrez"],
    explain: `The <code>;</code> keeps the subject <code>?gene</code> and adds more predicates. Try removing the FILTER to see how many languages label this gene.`,
  },
  {
    id: "JOIN",
    title: "Genes Behind a Disease",
    track: "wd",
    endpoint: "wikidata",
    concept: "Joins & the label service",
    prereqs: ["LABL"],
    story: `
      <p>Parkinson's disease is the fastest-growing neurological disorder worldwide. Most cases are sporadic, but genome-wide association studies (GWAS) and family studies have linked dozens of genes — <i>SNCA</i>, <i>LRRK2</i>, <i>GBA1</i>, <i>PRKN</i> — to disease risk.</p>
      <p>Wikidata records such links with <a href="https://www.wikidata.org/wiki/Property:P2293" target="_blank">P2293</a> (<i>genetic association</i>), pointing <b>from the disease to the gene</b>. Parkinson's disease is <a href="https://www.wikidata.org/wiki/Q11085" target="_blank">wd:Q11085</a>.</p>`,
    lesson: `
      <p>Now the item is <i>known</i> and the object is the variable. Wikidata offers a <b>label service</b> that adds a <code>?xLabel</code> column for every <code>?x</code>:</p>
<pre>SELECT ?symptom ?symptomLabel WHERE {
  wd:Q12204 wdt:P780 ?symptom .          # tuberculosis → symptoms
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}</pre>`,
    task: `List all genes genetically associated with Parkinson's disease, with their English labels.`,
    returns: ["gene", "geneLabel"],
    sample: `gene, geneLabel\nhttp://www.wikidata.org/entity/Q…, SNCA`,
    hint: `The disease is the subject, <code>wdt:P2293</code> the predicate.`,
    starter: WD_PREFIXES + `
SELECT ?gene ?geneLabel WHERE {

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`,
    solution: WD_PREFIXES + `
SELECT ?gene ?geneLabel WHERE {
  wd:Q11085 wdt:P2293 ?gene .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`,
    check: ["gene"],
    explain: `Many of these associations were imported from GWAS catalog studies, each backed by a reference you can inspect on the item page. A good habit: always ask <i>where does this edge come from?</i>`,
  },
  {
    id: "HOPS",
    title: "From Gene to Protein",
    track: "wd",
    endpoint: "wikidata",
    concept: "Multi-hop joins, property paths ( / )",
    prereqs: ["JOIN"],
    story: `
      <p>Drugs, antibodies and assays act on <b>proteins</b>, not genes. To move from a list of Parkinson's genes to something a pharmacologist can use, you need the encoded proteins and their <b>UniProt accessions</b> — the identifiers every protein database understands.</p>
      <p>Gene items point to their product with <a href="https://www.wikidata.org/wiki/Property:P688" target="_blank">P688</a> (<i>encodes</i>), and protein items carry their accession in <a href="https://www.wikidata.org/wiki/Property:P352" target="_blank">P352</a> (<i>UniProt protein ID</i>).</p>`,
    lesson: `
      <p>Chain patterns by reusing variables: the object of one triple becomes the subject of the next. A <b>sequence path</b> <code>/</code> walks several predicates in one step when you don't need the node in between:</p>
<pre>?drug wdt:P129 ?target .        # physically interacts with
?target wdt:P352 ?acc .
# is the same as
?drug wdt:P129/wdt:P352 ?acc .</pre>`,
    task: `For every gene associated with Parkinson's disease, return the gene and the UniProt accession(s) of the protein(s) it encodes.`,
    returns: ["gene", "uniprot"],
    sample: `gene, uniprot\nhttp://www.wikidata.org/entity/Q14862268, P37840`,
    hint: `Disease → (P2293) → gene → (P688) → protein → (P352) → accession.`,
    starter: WD_PREFIXES + `
SELECT ?gene ?uniprot WHERE {

}`,
    solution: WD_PREFIXES + `
SELECT ?gene ?uniprot WHERE {
  wd:Q11085 wdt:P2293 ?gene .
  ?gene wdt:P688/wdt:P352 ?uniprot .
}`,
    check: ["gene", "uniprot"],
    explain: `<code>P37840</code> is α-synuclein, the main component of Lewy bodies. Genes without a protein item silently drop out of a join — the next problem shows how to keep them.`,
  },
  {
    id: "OPTN",
    title: "Incomplete Records",
    track: "wd",
    endpoint: "wikidata",
    concept: "OPTIONAL",
    prereqs: ["JOIN"],
    story: `
      <p>Multiple sclerosis (MS, <a href="https://www.wikidata.org/wiki/Q8277" target="_blank">wd:Q8277</a>) is an autoimmune disease of the central nervous system. Its treatment shelf mixes small molecules (fingolimod, teriflunomide) with biologics (natalizumab, ocrelizumab).</p>
      <p>A chemist wants each drug's <b>PubChem CID</b> (<a href="https://www.wikidata.org/wiki/Property:P662" target="_blank">P662</a>) to fetch structures. But antibodies have no small-molecule structure, so they lack a CID. Treatments are listed on the disease via <a href="https://www.wikidata.org/wiki/Property:P2176" target="_blank">P2176</a> (<i>drug or therapy used for treatment</i>).</p>`,
    lesson: `
      <p>In a plain join, a row disappears if <i>any</i> pattern fails to match. <code>OPTIONAL { … }</code> keeps the row and leaves the variable unbound instead:</p>
<pre>SELECT ?gene ?omim WHERE {
  wd:Q11081 wdt:P2293 ?gene .
  OPTIONAL { ?gene wdt:P492 ?omim }
}</pre>`,
    task: `List <b>every</b> drug used for treating multiple sclerosis together with its PubChem CID <i>if it has one</i>.`,
    returns: ["drug", "cid"],
    sample: `drug, cid\nhttp://www.wikidata.org/entity/Q…, 2265\nhttp://www.wikidata.org/entity/Q…, (empty)`,
    hint: `Compare the number of distinct drugs with and without OPTIONAL.`,
    starter: WD_PREFIXES + `
SELECT ?drug ?cid WHERE {

}`,
    solution: WD_PREFIXES + `
SELECT ?drug ?cid WHERE {
  wd:Q8277 wdt:P2176 ?drug .
  OPTIONAL { ?drug wdt:P662 ?cid }
}`,
    check: ["drug"],
    explain: `Notice some drugs return <i>several</i> CIDs (salt forms, stereo-isomers, mixtures). Real data are messier than schemas suggest — always inspect the rows, not just the count.`,
  },
  {
    id: "FILT",
    title: "Small Molecules",
    track: "wd",
    endpoint: "wikidata",
    concept: "FILTER with numbers",
    prereqs: ["JOIN"],
    story: `
      <p>Hypertension (<a href="https://www.wikidata.org/wiki/Q41861" target="_blank">wd:Q41861</a>) affects more than a billion people. Medicinal chemists like Lipinski's "rule of five", which favours oral drugs with a molecular mass below 500 Da.</p>
      <p>Wikidata stores mass in daltons via <a href="https://www.wikidata.org/wiki/Property:P2067" target="_blank">P2067</a>.</p>`,
    lesson: `
      <p><code>FILTER</code> accepts comparisons (<code>&lt; &gt; = != &lt;= &gt;=</code>), logic (<code>&amp;&amp; || !</code>) and functions:</p>
<pre>?protein wdt:P2067 ?mass .
FILTER(?mass &gt; 100000 &amp;&amp; ?mass &lt; 200000)</pre>`,
    task: `Find the drugs used for treating hypertension whose mass is <b>below 300 Da</b>. Return the drug, its English label and its mass.`,
    returns: ["drug", "drugLabel", "mass"],
    sample: `drug, drugLabel, mass\nhttp://www.wikidata.org/entity/Q412221, clonidine, 229.017`,
    hint: `Treatment property is <code>wdt:P2176</code> from the disease.`,
    starter: WD_PREFIXES + `
SELECT ?drug ?drugLabel ?mass WHERE {

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`,
    solution: WD_PREFIXES + `
SELECT ?drug ?drugLabel ?mass WHERE {
  wd:Q41861 wdt:P2176 ?drug .
  ?drug wdt:P2067 ?mass .
  FILTER(?mass < 300)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`,
    check: ["drug"],
    explain: `Small antihypertensives such as clonidine and atenolol show up. Place FILTERs anywhere in the group — they apply to the whole group.`,
  },
  {
    id: "ORDR",
    title: "Heavyweights",
    track: "wd",
    endpoint: "wikidata",
    concept: "ORDER BY, LIMIT",
    prereqs: ["FILT"],
    story: `
      <p>At the other end of the scale, the heaviest "drugs" in the hypertension list are often <b>fixed-dose combinations</b> recorded as single items — a reminder that a Wikidata "drug" may be a product, not a molecule.</p>`,
    lesson: `
      <p>Sort with <code>ORDER BY ?x</code> (ascending) or <code>ORDER BY DESC(?x)</code>, and cut the result with <code>LIMIT n</code>:</p>
<pre>SELECT ?gene ?len WHERE { … }
ORDER BY DESC(?len)
LIMIT 3</pre>`,
    task: `Return the <b>five heaviest</b> drugs used for treating hypertension, heaviest first.`,
    returns: ["drug", "drugLabel", "mass"],
    sample: `drug, drugLabel, mass\nhttp://www.wikidata.org/entity/Q…, sacubitril/valsartan, 930.388`,
    hint: `Remove the FILTER from the previous problem and add ORDER BY and LIMIT after the closing brace.`,
    starter: WD_PREFIXES + `
SELECT ?drug ?drugLabel ?mass WHERE {

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`,
    solution: WD_PREFIXES + `
SELECT ?drug ?drugLabel ?mass WHERE {
  wd:Q41861 wdt:P2176 ?drug .
  ?drug wdt:P2067 ?mass .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?mass)
LIMIT 5`,
    check: ["drug"],
    explain: `ORDER BY and LIMIT are <i>solution modifiers</i>: they act after the pattern has been matched.`,
  },
  {
    id: "CNTG",
    title: "The Most Studied Diseases",
    track: "wd",
    endpoint: "wikidata",
    concept: "COUNT, GROUP BY",
    prereqs: ["ORDR"],
    story: `
      <p>Which diseases have the most genes linked to them? The answer says as much about where research money goes (GWAS cohorts for obesity, Alzheimer's and diabetes) as about biology.</p>`,
    lesson: `
      <p>Aggregates collapse rows. <code>GROUP BY</code> decides which rows go together; <code>COUNT</code>, <code>SUM</code>, <code>AVG</code>, <code>MIN</code>, <code>MAX</code> summarise each group:</p>
<pre>SELECT ?chromosome (COUNT(?gene) AS ?n) WHERE {
  ?gene wdt:P1057 ?chromosome .
}
GROUP BY ?chromosome</pre>
      <p>Use <code>COUNT(DISTINCT ?x)</code> when the same value can appear in several rows.</p>`,
    task: `Over <i>all</i> of Wikidata, find the <b>10 diseases</b> with the largest number of distinct genetically associated genes. Return the disease and the count as <code>?genes</code>, largest first.`,
    returns: ["disease", "genes"],
    sample: `disease, genes\nhttp://www.wikidata.org/entity/Q12174, 3…`,
    hint: `Pattern: <code>?disease wdt:P2293 ?gene</code>. Group by ?disease, order by DESC(?genes), LIMIT 10.`,
    starter: WD_PREFIXES + `
SELECT ?disease (COUNT(DISTINCT ?gene) AS ?genes) WHERE {
  
}
# GROUP BY …
# ORDER BY …
# LIMIT …`,
    solution: WD_PREFIXES + `
SELECT ?disease (COUNT(DISTINCT ?gene) AS ?genes) WHERE {
  ?disease wdt:P2293 ?gene .
}
GROUP BY ?disease
ORDER BY DESC(?genes)
LIMIT 10`,
    check: ["disease", "genes"],
    explain: `Look closely at the list: is <i>smallpox</i> there? Its "genes" are largely variola virus genes, not human risk genes. The same property can mean different things on different items — a classic knowledge-graph pitfall.`,
  },
  {
    id: "PATH",
    title: "The Diabetes Family",
    track: "wd",
    endpoint: "wikidata",
    concept: "Transitive property paths ( * + )",
    prereqs: ["JOIN"],
    story: `
      <p>"Diabetes" is not one disease. Type 1, type 2, gestational diabetes, MODY, neonatal and drug-induced forms differ in cause and treatment. Disease ontologies organise them in a <b>hierarchy</b>, which Wikidata encodes with <a href="https://www.wikidata.org/wiki/Property:P279" target="_blank">P279</a> (<i>subclass of</i>). Diabetes is <a href="https://www.wikidata.org/wiki/Q12206" target="_blank">wd:Q12206</a>.</p>`,
    lesson: `
      <p>Property paths can repeat: <code>p+</code> means one or more hops, <code>p*</code> zero or more (so the start node is included), <code>p?</code> zero or one.</p>
<pre>?cancer wdt:P279+ wd:Q12078 .   # all kinds of cancer, any depth</pre>`,
    task: `Return diabetes and <b>every subclass at any depth</b> below it.`,
    returns: ["disease"],
    sample: `disease\nhttp://www.wikidata.org/entity/Q12206\nhttp://www.wikidata.org/entity/Q124407`,
    hint: `The start node must be included — which operator gives "zero or more"?`,
    starter: WD_PREFIXES + `
SELECT ?disease WHERE {

}`,
    solution: WD_PREFIXES + `
SELECT ?disease WHERE {
  ?disease wdt:P279* wd:Q12206 .
}`,
    check: ["disease"],
    explain: `Compare with a single <code>wdt:P279</code> hop: the transitive version finds several times more classes. Some may surprise you (feline diabetes!) — hierarchies inherit their editors' modelling choices.`,
  },
  {
    id: "UNIO",
    title: "Two Sides of a Story",
    track: "wd",
    endpoint: "wikidata",
    concept: "UNION",
    prereqs: ["OPTN"],
    story: `
      <p>Wikidata can say "type 2 diabetes is treated with metformin" in two places: on the disease (<code>P2176</code>, <i>drug used for treatment</i>) or on the drug (<a href="https://www.wikidata.org/wiki/Property:P2175" target="_blank">P2175</a>, <i>medical condition treated</i>). Editors don't always add both. Type 2 diabetes is <a href="https://www.wikidata.org/wiki/Q3025883" target="_blank">wd:Q3025883</a>.</p>`,
    lesson: `
      <p><code>{ A } UNION { B }</code> returns the rows of A plus the rows of B. Use <code>SELECT DISTINCT</code> to drop duplicates found by both branches:</p>
<pre>SELECT DISTINCT ?x WHERE {
  { ?x wdt:P31 wd:Q12136 } UNION { ?x wdt:P31 wd:Q929833 }
}</pre>`,
    task: `Find all distinct drugs linked to type 2 diabetes <b>in either direction</b>.`,
    returns: ["drug"],
    sample: `drug\nhttp://www.wikidata.org/entity/Q…`,
    hint: `Branch 1: disease P2176 ?drug. Branch 2: ?drug P2175 disease.`,
    starter: WD_PREFIXES + `
SELECT DISTINCT ?drug WHERE {

}`,
    solution: WD_PREFIXES + `
SELECT DISTINCT ?drug WHERE {
  { wd:Q3025883 wdt:P2176 ?drug }
  UNION
  { ?drug wdt:P2175 wd:Q3025883 }
}`,
    check: ["drug"],
    explain: `Run each branch alone: neither is complete. When the same fact can be stated in two directions, query both. (A path alternative <code>(wdt:P2176|^wdt:P2175)</code> does the same in one line — <code>^</code> reverses a predicate.)`,
  },
  {
    id: "NEXI",
    title: "One-Sided Statements",
    track: "wd",
    endpoint: "wikidata",
    concept: "FILTER NOT EXISTS, MINUS",
    prereqs: ["UNIO"],
    story: `
      <p>You volunteer to curate Wikidata. Your first job: find drugs that claim to treat type 2 diabetes (<code>P2175</code> on the drug) but are <b>missing</b> from the disease's own treatment list (<code>P2176</code>). That is a to-do list for editors.</p>`,
    lesson: `
      <p><code>FILTER NOT EXISTS { … }</code> keeps a row only if the inner pattern has <i>no</i> match for it:</p>
<pre>?gene wdt:P353 ?symbol .
FILTER NOT EXISTS { ?gene wdt:P688 ?protein }   # genes without protein</pre>
      <p><code>MINUS { … }</code> is similar but removes rows by comparing shared variables.</p>`,
    task: `List drugs that state they treat type 2 diabetes, but which type 2 diabetes does <b>not</b> list as a treatment.`,
    returns: ["drug"],
    sample: `drug\nhttp://www.wikidata.org/entity/Q…`,
    hint: `Start from <code>?drug wdt:P2175 wd:Q3025883</code> and exclude the reverse statement.`,
    starter: WD_PREFIXES + `
SELECT ?drug WHERE {

}`,
    solution: WD_PREFIXES + `
SELECT ?drug WHERE {
  ?drug wdt:P2175 wd:Q3025883 .
  FILTER NOT EXISTS { wd:Q3025883 wdt:P2176 ?drug }
}`,
    check: ["drug"],
    explain: `Queries are also a <b>data-quality tool</b>. Many WikiProjects run queries like this one to generate maintenance lists.`,
  },
  {
    id: "VALS",
    title: "A Hereditary Cancer Panel",
    track: "wd",
    endpoint: "wikidata",
    concept: "VALUES",
    prereqs: ["LABL"],
    story: `
      <p>Hereditary breast and ovarian cancer panels test a fixed list of genes: <code>BRCA1 BRCA2 TP53 PTEN ATM CHEK2 PALB2</code>. A lab report needs the chromosome each gene sits on (<a href="https://www.wikidata.org/wiki/Property:P1057" target="_blank">P1057</a>).</p>
      <p>Careful: HGNC symbols are unique for human genes, but Wikidata also holds mouse and rat genes. Restrict to <i>Homo sapiens</i> (<a href="https://www.wikidata.org/wiki/Q15978631" target="_blank">wd:Q15978631</a>) via <a href="https://www.wikidata.org/wiki/Property:P703" target="_blank">P703</a> (<i>found in taxon</i>).</p>`,
    lesson: `
      <p><code>VALUES</code> injects a fixed table of bindings into a query:</p>
<pre>VALUES ?disease { wd:Q12206 wd:Q11081 }
VALUES ?symbol  { "INS" "GCG" }</pre>`,
    task: `For the seven panel genes, return the symbol and the chromosome item of each human gene.`,
    returns: ["symbol", "chromosome"],
    sample: `symbol, chromosome\nBRCA1, http://www.wikidata.org/entity/Q…`,
    hint: `Bind <code>?symbol</code> with VALUES, then match <code>?gene wdt:P353 ?symbol</code>.`,
    starter: WD_PREFIXES + `
SELECT ?symbol ?chromosome WHERE {
  VALUES ?symbol { "BRCA1" "BRCA2" "TP53" "PTEN" "ATM" "CHEK2" "PALB2" }

}`,
    solution: WD_PREFIXES + `
SELECT ?symbol ?chromosome WHERE {
  VALUES ?symbol { "BRCA1" "BRCA2" "TP53" "PTEN" "ATM" "CHEK2" "PALB2" }
  ?gene wdt:P353 ?symbol ;
        wdt:P703 wd:Q15978631 ;
        wdt:P1057 ?chromosome .
}`,
    check: ["symbol", "chromosome"],
    explain: `Add <code>?chromosomeLabel</code> with the label service to make it readable. VALUES is the cleanest way to pass a gene list, a cohort or a set of IDs into a query.`,
  },

  // --------------------------------------------------------------- UniProt
  {
    id: "UNIP",
    title: "Hello, UniProt",
    track: "sib",
    endpoint: "uniprot",
    concept: "A new vocabulary, nested nodes",
    prereqs: ["TRPL"],
    story: `
      <p>In 1921 Banting and Best isolated <b>insulin</b>; in 1955 Sanger sequenced it — the first protein ever sequenced. Its UniProt entry today holds decades of curated knowledge.</p>
      <p>UniProt publishes its knowledgebase as RDF using its own <a href="https://purl.uniprot.org/core/" target="_blank">core ontology</a> (prefix <code>up:</code>). Every entry has a short <b>mnemonic</b> such as <code>INS_HUMAN</code> (<code>up:mnemonic</code>). The recommended name is not a plain string but a <i>node</i>: <code>up:recommendedName</code> points to a structured name whose <code>up:fullName</code> is the text.</p>`,
    lesson: `
      <p>Different graphs, different vocabularies — but the same SPARQL. Here you'll query <b>sparql.uniprot.org</b>. Following an intermediate node is just another join:</p>
<pre>?protein up:recommendedName ?rn .
?rn up:shortName ?short .
# or with a path:  ?protein up:recommendedName/up:shortName ?short</pre>`,
    task: `Return the UniProt entry with mnemonic <code>INS_HUMAN</code> and its recommended full name.`,
    returns: ["protein", "name"],
    sample: `protein, name\nhttp://purl.uniprot.org/uniprot/P01308, Insulin`,
    hint: `<code>?protein up:mnemonic "INS_HUMAN"</code>.`,
    starter: UP_PREFIXES + `
SELECT ?protein ?name WHERE {

}`,
    solution: UP_PREFIXES + `
SELECT ?protein ?name WHERE {
  ?protein a up:Protein ;
           up:mnemonic "INS_HUMAN" ;
           up:recommendedName/up:fullName ?name .
}`,
    check: ["protein"],
    explain: `<code>a</code> is shorthand for <code>rdf:type</code>. Explore the entry yourself: <code>SELECT ?p ?o WHERE { uniprot:P01308 ?p ?o }</code>.`,
  },
  {
    id: "UPDS",
    title: "Parkinson Proteins",
    track: "sib",
    endpoint: "uniprot",
    concept: "String functions in FILTER",
    prereqs: ["UNIP", "FILT"],
    story: `
      <p>UniProt curators attach <b>disease annotations</b> to proteins when variants in them cause a disorder. Monogenic forms of Parkinson's are numbered: "Parkinson disease 1, autosomal dominant" (SNCA), "Parkinson disease 2" (PRKN), and so on.</p>
      <p>Annotations are nodes of class <code>up:Disease_Annotation</code>, linked from the protein via <code>up:annotation</code>; they point with <code>up:disease</code> to a disease whose name is <code>skos:prefLabel</code>. Human is <code>taxon:9606</code>; curated Swiss-Prot entries have <code>up:reviewed true</code>.</p>`,
    lesson: `
      <p>Useful string functions: <code>CONTAINS(s, "x")</code>, <code>STRSTARTS(s, "x")</code>, <code>LCASE(s)</code>, <code>REGEX(s, "^x", "i")</code>.</p>
<pre>FILTER(CONTAINS(LCASE(?name), "kinase"))</pre>`,
    task: `Find reviewed human proteins with a disease annotation whose disease name <b>starts with</b> <code>Parkinson disease</code>. Return the protein and disease name.`,
    returns: ["protein", "diseaseName"],
    sample: `protein, diseaseName\nhttp://purl.uniprot.org/uniprot/P37840, Parkinson disease 1, autosomal dominant`,
    hint: `Try <code>CONTAINS(LCASE(?diseaseName), "parkinson")</code> first and look for a heart condition in the results.`,
    starter: UP_PREFIXES + `
SELECT ?protein ?diseaseName WHERE {
  ?protein a up:Protein ;
           up:reviewed true ;
           up:organism taxon:9606 .

}`,
    solution: UP_PREFIXES + `
SELECT ?protein ?diseaseName WHERE {
  ?protein a up:Protein ;
           up:reviewed true ;
           up:organism taxon:9606 ;
           up:annotation ?a .
  ?a a up:Disease_Annotation ;
     up:disease/skos:prefLabel ?diseaseName .
  FILTER(STRSTARTS(?diseaseName, "Parkinson disease"))
}`,
    check: ["protein"],
    explain: `A loose CONTAINS would also catch <i>Wolff-Parkinson-White syndrome</i>, a cardiac arrhythmia named after a different Parkinson. Text matching is not identity — prefer IRIs when you can.`,
  },
  {
    id: "GOTE",
    title: "Insulin Signalling",
    track: "sib",
    endpoint: "uniprot",
    concept: "Ontology IRIs (Gene Ontology)",
    prereqs: ["UNIP"],
    story: `
      <p>Insulin resistance — cells failing to respond to insulin — is the core defect of type 2 diabetes. The <a href="https://amigo.geneontology.org/amigo/term/GO:0008286" target="_blank">Gene Ontology term GO:0008286</a> <i>insulin receptor signaling pathway</i> collects the proteins involved.</p>
      <p>UniProt links proteins to GO terms with <code>up:classifiedWith</code>. GO terms are IRIs under the OBO namespace: <code>obo:GO_0008286</code>.</p>`,
    lesson: `
      <p>Using a shared ontology IRI instead of a text label makes queries precise and portable: the same <code>obo:GO_…</code> IRI works in UniProt, Wikidata mappings, Bgee and many other resources.</p>`,
    task: `List reviewed human proteins annotated with GO:0008286, with their mnemonic.`,
    returns: ["protein", "mnemonic"],
    sample: `protein, mnemonic\nhttp://purl.uniprot.org/uniprot/P06213, INSR_HUMAN`,
    hint: `Combine reviewed/organism patterns with <code>up:classifiedWith obo:GO_0008286</code>.`,
    starter: UP_PREFIXES + `
SELECT ?protein ?mnemonic WHERE {

}`,
    solution: UP_PREFIXES + `
SELECT ?protein ?mnemonic WHERE {
  ?protein a up:Protein ;
           up:reviewed true ;
           up:organism taxon:9606 ;
           up:mnemonic ?mnemonic ;
           up:classifiedWith obo:GO_0008286 .
}`,
    check: ["protein"],
    explain: `You'll find the receptor INSR, its substrates IRS1/IRS2 and the PI3K subunits — the textbook pathway, recovered by one triple.`,
  },
  {
    id: "RHEA",
    title: "Cholesterol Enzymes",
    track: "sib",
    endpoint: "uniprot",
    concept: "Federated queries (SERVICE)",
    prereqs: ["GOTE", "HOPS"],
    story: `
      <p>Cholesterol is synthesised, transported, esterified, sulfated and turned into steroid hormones and bile acids. Statins, the most prescribed drugs on earth, block one enzyme of this network.</p>
      <p>Reactions live in <b>Rhea</b>, a separate SPARQL endpoint at SIB. Rhea reactions have sides (<code>rh:side</code>) that contain participants (<code>rh:contains</code>) whose compound (<code>rh:compound</code>) maps to a ChEBI identifier (<code>rh:chebi</code>). Cholesterol is <code>CHEBI:16113</code>. UniProt links enzymes to Rhea reactions through catalytic-activity annotations: <code>up:annotation/up:catalyticActivity/up:catalyzedReaction</code>.</p>`,
    lesson: `
      <p><code>SERVICE &lt;endpoint&gt; { … }</code> sends part of a query to another endpoint and joins the answers locally — this is how linked data becomes one big graph:</p>
<pre>SERVICE &lt;https://sparql.rhea-db.org/sparql&gt; {
  ?reaction rh:equation ?eq .
}</pre>`,
    task: `Find reviewed human enzymes that catalyse a Rhea reaction involving cholesterol. Return the protein and the reaction equation.`,
    returns: ["protein", "equation"],
    sample: `protein, equation\nhttp://purl.uniprot.org/uniprot/O15118, cholesterol(in) = cholesterol(out)`,
    hint: `Inside SERVICE: <code>?rhea rh:side/rh:contains/rh:compound/rh:chebi CHEBI:16113 ; rh:equation ?equation</code>. Outside: annotation of type <code>up:Catalytic_Activity_Annotation</code>.`,
    starter: UP_PREFIXES + `PREFIX rh: <http://rdf.rhea-db.org/>
PREFIX CHEBI: <http://purl.obolibrary.org/obo/CHEBI_>

SELECT DISTINCT ?protein ?equation WHERE {
  SERVICE <https://sparql.rhea-db.org/sparql> {

  }

}`,
    solution: UP_PREFIXES + `PREFIX rh: <http://rdf.rhea-db.org/>
PREFIX CHEBI: <http://purl.obolibrary.org/obo/CHEBI_>

SELECT DISTINCT ?protein ?equation WHERE {
  SERVICE <https://sparql.rhea-db.org/sparql> {
    ?rhea rh:side/rh:contains/rh:compound/rh:chebi CHEBI:16113 ;
          rh:equation ?equation .
  }
  ?protein up:reviewed true ;
           up:organism taxon:9606 ;
           up:annotation ?a .
  ?a a up:Catalytic_Activity_Annotation ;
     up:catalyticActivity/up:catalyzedReaction ?rhea .
}`,
    check: ["protein"],
    explain: `The answer spans sulfotransferases, transporters like NPC1 (whose loss causes Niemann–Pick type C) and acyltransferases. Two endpoints, one query.`,
  },
  {
    id: "FEDW",
    title: "Bridging Wikidata and UniProt",
    track: "sib",
    endpoint: "wikidata",
    concept: "BIND, IRI(), CONCAT, federation",
    prereqs: ["HOPS", "UNIP"],
    story: `
      <p>Wikidata knows which genes GWAS links to Parkinson's; UniProt knows what the proteins <i>are</i>. Wikidata stores UniProt accessions as plain strings (<code>"P37840"</code>), while UniProt's RDF uses IRIs (<code>&lt;http://purl.uniprot.org/uniprot/P37840&gt;</code>). To join them you must <b>build the IRI</b>.</p>
      <p>This query runs on Wikidata and calls UniProt (allowed on WDQS's federation list).</p>`,
    lesson: `
      <p><code>BIND(expression AS ?var)</code> computes new values. Turn a string into an IRI with <code>IRI(CONCAT(base, ?id))</code>:</p>
<pre>?gene wdt:P351 ?entrez .
BIND(IRI(CONCAT("https://www.ncbi.nlm.nih.gov/gene/", ?entrez)) AS ?ncbi)</pre>`,
    task: `For Parkinson's-associated genes in Wikidata, take each encoded protein's UniProt accession and fetch its <b>recommended full name from UniProt</b>.`,
    returns: ["uniprot", "name"],
    sample: `uniprot, name\nP37840, Alpha-synuclein`,
    hint: `After the HOPS pattern, BIND <code>?up</code> to <code>IRI(CONCAT("http://purl.uniprot.org/uniprot/", ?uniprot))</code>, then <code>SERVICE &lt;https://sparql.uniprot.org/sparql&gt; { ?up up:recommendedName/up:fullName ?name }</code>.`,
    starter: WD_PREFIXES + `PREFIX up: <http://purl.uniprot.org/core/>

SELECT ?uniprot ?name WHERE {
  wd:Q11085 wdt:P2293/wdt:P688/wdt:P352 ?uniprot .

}`,
    solution: WD_PREFIXES + `PREFIX up: <http://purl.uniprot.org/core/>

SELECT ?uniprot ?name WHERE {
  wd:Q11085 wdt:P2293/wdt:P688/wdt:P352 ?uniprot .
  BIND(IRI(CONCAT("http://purl.uniprot.org/uniprot/", ?uniprot)) AS ?up)
  SERVICE <https://sparql.uniprot.org/sparql> {
    ?up up:recommendedName/up:fullName ?name .
  }
}`,
    check: ["uniprot"],
    explain: `Identifier mismatches (strings vs IRIs, http vs https, different base URIs) are the most common reason federated queries return nothing. <code>BIND(IRI(CONCAT(…)))</code> is your adapter.`,
  },

  // ------------------------------------------------------------ RDF Portal
  {
    id: "MESH",
    title: "The Neurodegeneration Tree",
    track: "rp",
    endpoint: "rdfportal_ncbi",
    concept: "Named graphs (FROM), tree paths",
    prereqs: ["PATH"],
    story: `
      <p><b>MeSH</b> (Medical Subject Headings) is the vocabulary NLM uses to index every PubMed article. Its descriptors are arranged in <b>trees</b>: "Neurodegenerative Diseases" (<code>mesh:D019636</code>) has tree numbers such as <code>C10.574</code>, and everything below it has a tree number whose parent chain leads there.</p>
      <p>The Japanese <a href="https://rdfportal.org" target="_blank">RDF Portal</a> (DBCLS) hosts MeSH alongside ClinVar, PubMed and NCBI Gene in one endpoint, each in its own <b>named graph</b> — MeSH lives in <code>&lt;http://id.nlm.nih.gov/mesh&gt;</code>. Vocabulary: <code>meshv:treeNumber</code> (descriptor → tree number) and <code>meshv:parentTreeNumber</code> (tree number → parent).</p>`,
    lesson: `
      <p>A big endpoint stores many datasets as separate graphs. <code>FROM &lt;graph&gt;</code> restricts the query to one of them — faster and safer:</p>
<pre>SELECT ?label
FROM &lt;http://id.nlm.nih.gov/mesh&gt;
WHERE { mesh:D010300 rdfs:label ?label }</pre>`,
    task: `List every MeSH descriptor located anywhere <b>below</b> "Neurodegenerative Diseases" in the tree, with its label.`,
    returns: ["descriptor", "label"],
    sample: `descriptor, label\nhttp://id.nlm.nih.gov/mesh/D020961, Lewy Body Disease`,
    hint: `Get the top tree number(s) of D019636, then <code>?tn meshv:parentTreeNumber+ ?top</code>, then <code>?descriptor meshv:treeNumber ?tn</code>.`,
    starter: `PREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#>
PREFIX mesh: <http://id.nlm.nih.gov/mesh/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?descriptor ?label
FROM <http://id.nlm.nih.gov/mesh>
WHERE {

}`,
    solution: `PREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#>
PREFIX mesh: <http://id.nlm.nih.gov/mesh/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?descriptor ?label
FROM <http://id.nlm.nih.gov/mesh>
WHERE {
  mesh:D019636 meshv:treeNumber ?top .
  ?tn meshv:parentTreeNumber+ ?top .
  ?descriptor meshv:treeNumber ?tn ;
              rdfs:label ?label .
}`,
    check: ["descriptor"],
    explain: `MeSH is polyhierarchical: a descriptor can sit in several trees (Neurofibromatosis 1 appears here through one of its positions). Paths over tree numbers rather than descriptors keep each position explicit.`,
  },
  {
    id: "CHPD",
    title: "Late-Stage Parkinson Drugs",
    track: "rp",
    endpoint: "rdfportal_ebi",
    concept: "Typed resources, numeric FILTER on a new graph",
    prereqs: ["MESH", "FILT"],
    story: `
      <p><b>ChEMBL</b> (EMBL-EBI) curates bioactive molecules and their clinical development. A <code>cco:DrugIndication</code> links a molecule (<code>cco:hasMolecule</code>) to a disease expressed as a MeSH term (<code>cco:hasMesh</code>, e.g. <code>&lt;http://identifiers.org/mesh/D010300&gt;</code> for Parkinson Disease) and records the highest clinical phase reached (<code>cco:highestDevelopmentPhase</code>, 4 = approved).</p>
      <p>ChEMBL is in the graph <code>&lt;http://rdf.ebi.ac.uk/dataset/chembl&gt;</code> on RDF Portal's EBI endpoint.</p>`,
    lesson: `
      <p>Note how ChEMBL refers to MeSH with an <i>identifiers.org</i> IRI, while NLM's own MeSH RDF uses <code>id.nlm.nih.gov</code>. Same concept, two IRIs — check which form a dataset uses before joining.</p>`,
    task: `Find molecules with a Parkinson's disease indication that reached <b>phase 3 or higher</b>. Return the molecule, its label and the phase.`,
    returns: ["molecule", "label", "phase"],
    sample: `molecule, label, phase\nhttp://rdf.ebi.ac.uk/resource/chembl/molecule/CHEMBL1009, LEVODOPA, 4`,
    hint: `<code>?ind a cco:DrugIndication ; cco:hasMolecule ?molecule ; cco:hasMesh mesh:D010300 ; cco:highestDevelopmentPhase ?phase</code>.`,
    starter: `PREFIX cco: <http://rdf.ebi.ac.uk/terms/chembl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX mesh: <http://identifiers.org/mesh/>

SELECT DISTINCT ?molecule ?label ?phase
FROM <http://rdf.ebi.ac.uk/dataset/chembl>
WHERE {

}`,
    solution: `PREFIX cco: <http://rdf.ebi.ac.uk/terms/chembl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX mesh: <http://identifiers.org/mesh/>

SELECT DISTINCT ?molecule ?label ?phase
FROM <http://rdf.ebi.ac.uk/dataset/chembl>
WHERE {
  ?ind a cco:DrugIndication ;
       cco:hasMolecule ?molecule ;
       cco:hasMesh mesh:D010300 ;
       cco:highestDevelopmentPhase ?phase .
  ?molecule rdfs:label ?label .
  FILTER(?phase >= 3)
}`,
    check: ["molecule"],
    explain: `Compare with the Wikidata answer for "drug used for treatment" of Parkinson's: ChEMBL includes failed and investigational phase-3 candidates, Wikidata mostly approved therapies. Different sources answer subtly different questions.`,
  },
  {
    id: "CHEM",
    title: "Drugs at the Dopamine Receptor",
    track: "rp",
    endpoint: "rdfportal_ebi",
    concept: "Linking datasets through shared IRIs",
    prereqs: ["CHPD", "UNIP"],
    story: `
      <p>The dopamine D2 receptor (UniProt <a href="https://www.uniprot.org/uniprotkb/P14416" target="_blank">P14416</a>) is the target of nearly every antipsychotic and of Parkinson's agonists like ropinirole. ChEMBL curates each approved drug's <b>mechanism of action</b>: a <code>cco:Mechanism</code> has a molecule (<code>cco:hasMolecule</code>), a target (<code>cco:hasTarget</code>) and an action type (<code>cco:mechanismActionType</code>).</p>
      <p>Targets consist of components (<code>cco:hasTargetComponent</code>) that ChEMBL maps to UniProt with <code>skos:exactMatch &lt;http://purl.uniprot.org/uniprot/…&gt;</code> — the very same IRIs UniProt uses. That shared IRI is what makes the web of data a <i>web</i>.</p>`,
    lesson: `
      <p>When two datasets use the same IRI for the same thing, you can join them without any mapping table. Use the UniProt IRI directly as an object:</p>
<pre>?tc skos:exactMatch &lt;http://purl.uniprot.org/uniprot/P35354&gt; .  # COX-2</pre>`,
    task: `List approved drugs (<code>cco:highestDevelopmentPhase 4</code>) with a curated mechanism on the dopamine D2 receptor, and the action type.`,
    returns: ["molecule", "label", "action"],
    sample: `molecule, label, action\nhttp://rdf.ebi.ac.uk/resource/chembl/molecule/CHEMBL1112, ARIPIPRAZOLE, PARTIAL AGONIST`,
    hint: `mechanism → target → target component → <code>skos:exactMatch</code> UniProt IRI.`,
    starter: `PREFIX cco: <http://rdf.ebi.ac.uk/terms/chembl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT DISTINCT ?molecule ?label ?action
FROM <http://rdf.ebi.ac.uk/dataset/chembl>
WHERE {

}`,
    solution: `PREFIX cco: <http://rdf.ebi.ac.uk/terms/chembl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT DISTINCT ?molecule ?label ?action
FROM <http://rdf.ebi.ac.uk/dataset/chembl>
WHERE {
  ?mech a cco:Mechanism ;
        cco:hasMolecule ?molecule ;
        cco:hasTarget ?target ;
        cco:mechanismActionType ?action .
  ?target cco:hasTargetComponent ?tc .
  ?tc skos:exactMatch <http://purl.uniprot.org/uniprot/P14416> .
  ?molecule rdfs:label ?label ;
            cco:highestDevelopmentPhase 4 .
}`,
    check: ["molecule"],
    explain: `Antagonists (antipsychotics), agonists (Parkinson's drugs) and partial agonists (aripiprazole) all bind the same receptor with opposite clinical effects — the action type is the key column.`,
  },
  {
    id: "CLIN",
    title: "CFTR Variants in the Clinic",
    track: "rp",
    endpoint: "rdfportal_ncbi",
    concept: "Aggregation over a deep, blank-node-rich graph",
    prereqs: ["CNTG", "MESH"],
    story: `
      <p>More than 2,000 variants of <b>CFTR</b> have been reported. Which ones are disease-causing decides who gets CFTR-modulator therapy. <b>ClinVar</b> aggregates laboratory classifications into a germline classification per variant: <i>Pathogenic</i>, <i>Likely benign</i>, <i>Uncertain significance</i>…</p>
      <p>On RDF Portal ClinVar sits in <code>&lt;http://rdfportal.org/dataset/clinvar&gt;</code>. A variation record (<code>?vcv</code>) has a <code>cvo:classified_record</code>; that record names the variant allele with <code>sio:SIO_000628</code> (<i>refers to</i>), and the allele points to its NCBI gene with <code>m2r:gene</code> — CFTR is <code>&lt;http://ncbi.nlm.nih.gov/gene/1080&gt;</code>. The classification text sits at <code>cvo:classifications/cvo:germline_classification/cvo:description</code>.</p>`,
    lesson: `
      <p>Real-world RDF is often deeply nested with anonymous (blank) nodes. Build the query one hop at a time: run, inspect with <code>?s ?p ?o</code>, add the next hop.</p>`,
    task: `Count distinct CFTR variation records per germline classification. Return <code>?classification</code> and <code>?variants</code>, largest first.`,
    returns: ["classification", "variants"],
    sample: `classification, variants\nUncertain significance, 2…`,
    hint: `<code>?allele m2r:gene &lt;…/gene/1080&gt; . ?cr sio:SIO_000628 ?allele . ?vcv cvo:classified_record ?cr .</code>`,
    starter: `PREFIX cvo: <http://purl.jp/bio/10/clinvar/>
PREFIX m2r: <http://med2rdf.org/ontology/med2rdf#>
PREFIX sio: <http://semanticscience.org/resource/>

SELECT ?classification (COUNT(DISTINCT ?vcv) AS ?variants)
FROM <http://rdfportal.org/dataset/clinvar>
WHERE {

}
`,
    solution: `PREFIX cvo: <http://purl.jp/bio/10/clinvar/>
PREFIX m2r: <http://med2rdf.org/ontology/med2rdf#>
PREFIX sio: <http://semanticscience.org/resource/>

SELECT ?classification (COUNT(DISTINCT ?vcv) AS ?variants)
FROM <http://rdfportal.org/dataset/clinvar>
WHERE {
  ?allele m2r:gene <http://ncbi.nlm.nih.gov/gene/1080> .
  ?cr sio:SIO_000628 ?allele .
  ?vcv cvo:classified_record ?cr .
  ?cr cvo:classifications/cvo:germline_classification/cvo:description ?classification .
}
GROUP BY ?classification
ORDER BY DESC(?variants)`,
    check: ["classification", "variants"],
    explain: `"Uncertain significance" dominates: most observed variants have not yet been classified as harmful or harmless. That gap is exactly what variant-interpretation research tries to close.`,
  },
];
