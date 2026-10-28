import { useState } from 'react';
import axios from 'axios';

const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const auth = () => ({ Authorization: 'Bearer ' + (localStorage.getItem('adam_access_token') || '') });

const tone: Record<string, string> = { pass: '#1e6e47', ok: '#1e6e47', warn: '#a86a12', fail: '#b42318', error: '#b42318' };
const pct = (x?: number) => (typeof x === 'number' ? (x * 100).toFixed(1).replace(/\.0$/, '') + '%' : 'n/a');

/**
 * Outcome chip for one pipeline step.
 * @param outcome - pass, ok, warn, fail or error
 * @param detail - optional short detail shown after the outcome
 */
function Chip({ outcome, detail }: { outcome?: string; detail?: string }) {
  if (!outcome) return <span style={{ color: '#888' }}>-</span>;
  const c = tone[outcome] || '#4a5568';
  return <span><b style={{ color: c, textTransform: 'uppercase', fontSize: 13 }}>{outcome}</b>
    {detail ? <span style={{ color: '#4a5568' }}> · {detail}</span> : null}</span>;
}

/**
 * Readable summary of an agent run: route, attempts, checks, R run, comparison, cost and sign-off.
 * @param r - run result, run state or review result returned by the API
 */
function RunSummary({ r }: { r: any }) {
  const p = r.review_packet || {};
  const history: any[] = r.history || [];
  const validation = r.validation || p.validation || {};
  const execution = r.execution || p.execution || {};
  const evaluation = r.evaluation || p.evaluation || {};
  const cost = r.cost || p.cost || {};
  const route = r.route || {};
  const replay = route.provider === 'replay' || history.some(h => h.provider === 'replay');
  const attempts = Array.from(new Set(history.map(h => h.attempt))).sort((a, b) => a - b);
  const step = (a: number, s: string) => history.find(h => h.attempt === a && h.step === s);
  const cell = { padding: '8px 10px', borderBottom: '1px solid #e2e6e3', textAlign: 'left' as const, verticalAlign: 'top' as const };
  const card = { border: '1px solid #d5dbd6', borderRadius: 8, padding: '12px 14px', background: '#fff' };
  return <section aria-label="Run summary" style={{ display: 'grid', gap: 14, margin: '16px 0' }}>
    {replay && <p role="note" style={{ margin: 0, padding: '10px 14px', borderRadius: 8, background: '#fff8e6', border: '1px solid #e8c77a', color: '#6b4a00' }}>
      <b>Replay mode:</b> recorded programs stand in for the model, so no AI model is called. The static checks, the R run, the comparison with the reference and the sign-off are live.</p>}
    <div style={card}>
      <b>Attempts</b> <span style={{ color: '#4a5568' }}>(the agent repairs and retries until every gate passes)</span>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 14 }}>
        <thead><tr>{['Attempt', 'Generate', 'Static checks', 'R run', 'Compare with reference'].map(h => <th key={h} style={{ ...cell, color: '#4a5568' }}>{h}</th>)}</tr></thead>
        <tbody>{attempts.map(a => { const g = step(a, 'generate'); return <tr key={a}>
          <td style={cell}>{a}</td>
          <td style={cell}><Chip outcome={g?.outcome} detail={g ? `${g.provider}:${g.model}` : ''} /></td>
          <td style={cell}><Chip outcome={step(a, 'validate')?.outcome} detail={step(a, 'validate')?.detail} /></td>
          <td style={cell}><Chip outcome={step(a, 'execute')?.outcome} detail={step(a, 'execute')?.detail} /></td>
          <td style={cell}><Chip outcome={step(a, 'evaluate')?.outcome} detail={step(a, 'evaluate')?.detail} /></td>
        </tr>; })}</tbody>
      </table>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      <div style={card}><b>Static checks</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 14 }}>
          {Object.entries(validation.checks || {}).map(([k, v]) => <li key={k}>{k.replace(/_/g, ' ')}: <Chip outcome={String(v)} /></li>)}
        </ul></div>
      <div style={card}><b>R run</b>
        <p style={{ margin: '6px 0 0', fontSize: 14 }}><Chip outcome={execution.success ? 'pass' : execution.success === false ? 'fail' : undefined} />
          {execution.rows != null && <> · {execution.rows} rows</>}{execution.duration_s != null && <> · {execution.duration_s}s</>}</p></div>
      <div style={card}><b>Compare with reference</b>
        <p style={{ margin: '6px 0 0', fontSize: 14 }}>
          <b style={{ fontSize: 22 }}>{evaluation.fully_matched_variables ?? '-'}/{evaluation.total_variables ?? '-'}</b> variables exact
          {evaluation.rows_reference != null && <><br />{evaluation.rows_matched_on_keys}/{evaluation.rows_reference} subjects matched on keys</>}
          <br />overall match {pct(evaluation.overall_match_rate)}</p></div>
      <div style={card}><b>Cost</b>
        <p style={{ margin: '6px 0 0', fontSize: 14 }}>{cost.calls ?? 0} generation call(s) · {(cost.prompt_tokens ?? 0) + (cost.completion_tokens ?? 0)} tokens
          <br />${cost.usd ?? 0} (Rs {cost.inr ?? 0})</p></div>
    </div>
    {r.review && <div style={{ ...card, borderColor: r.review.decision === 'approve' ? '#1e6e47' : '#b42318' }}>
      <b>Sign-off:</b> {r.review.decision === 'approve' ? 'approved' : 'rejected'} by <b>{r.review.reviewer}</b>
      {r.review.comment ? <> · "{r.review.comment}"</> : null}
      {r.final_program_path && <div style={{ fontSize: 13, color: '#4a5568', marginTop: 4 }}>Final program saved: {r.final_program_path.split(/[\\/]/).slice(-3).join('/')}</div>}
    </div>}
  </section>;
}

export default function AgentWorkbench() {
  const [spec, setSpec] = useState('dataset: ADSL\nkeys: [USUBJID]\nsdtm_domains: [dm]\nvariables:\n  - name: USUBJID');
  const [sdtm, setSdtm] = useState('benchmarks/pharmaverse/data/sdtm');
  const [reference, setReference] = useState('benchmarks/pharmaverse/data/reference/adsl.csv');
  const [runId, setRunId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [audit, setAudit] = useState<any>(null);
  const request = async (operation: () => Promise<any>) => {
    setBusy(true); setError('');
    try { const response = await operation(); setResult(response.data); if (response.data.run_id) setRunId(response.data.run_id); }
    catch (e: any) { setError(e.response?.data?.detail || e.message); }
    finally { setBusy(false); }
  };
  const api = base + '/api/v1/adam-agent';
  return <main style={{ maxWidth: 960, margin: '40px auto', fontFamily: 'system-ui', padding: 24 }}>
    <a href="/">Back to ADAM AI</a>
    <h1>Agentic clinical programming</h1>
    <p>Sign in through ADAM AI first. Verified runs require an isolated R executor and reference data.
      Approval requires an independent reviewer with the appropriate role.</p>
    <label style={{ display: 'block' }}>Dataset specification YAML
      <textarea style={{ display: 'block', width: '100%', minHeight: 150 }} value={spec} onChange={e => setSpec(e.target.value)} />
    </label>
    <label>SDTM folder <input style={{ width: '100%' }} value={sdtm} onChange={e => setSdtm(e.target.value)} /></label>
    <label>Reference dataset <input style={{ width: '100%' }} value={reference} onChange={e => setReference(e.target.value)} /></label>
    <button disabled={busy} onClick={() => request(() => axios.post(api + '/runs', {
      spec_yaml: spec, sdtm_dir: sdtm, reference_path: reference, write_dataset_json: true
    }, { headers: auth() }))}>{busy ? 'Working…' : 'Generate and verify'}</button>
    <hr />
    <label>Run ID <input value={runId} onChange={e => setRunId(e.target.value)} /></label>
    <button disabled={busy || !runId} onClick={() => request(() => axios.get(api + '/runs/' + encodeURIComponent(runId), { headers: auth() }))}>Load run</button>
    {result && <>
      <h2>{(result.awaiting_review || result.status === 'awaiting_review') ? 'Awaiting review'
        : result.status ? result.status.charAt(0).toUpperCase() + result.status.slice(1).replace(/_/g, ' ') : 'Run details'}</h2>
      <RunSummary r={result} />
      {(result.status === 'awaiting_review' || result.awaiting_review) && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>Review comment <input value={comment} onChange={e => setComment(e.target.value)} /></label>
        {(['approve', 'reject'] as const).map(decision => <button key={decision} disabled={busy}
          onClick={() => request(() => axios.post(api + '/runs/' + encodeURIComponent(runId) + '/review',
            { decision, comment }, { headers: auth() }))}>{decision === 'approve' ? 'Approve verified output' : 'Reject output'}</button>)}
      </div>}
      {error && <p role="alert" style={{ color: '#a00' }}>{error}</p>}
      <p><button onClick={async () => { try { setAudit((await axios.get(api + '/audit/verify', { headers: auth() })).data); } catch (e: any) { setError(e.response?.data?.detail || e.message); } }}>Verify audit log</button>
        {audit && <span style={{ marginLeft: 8 }}><Chip outcome={audit.intact ? 'pass' : 'fail'} detail={audit.intact ? 'hash chain intact' : `${audit.problems?.length} problem(s)`} /></span>}</p>
      <details><summary>Program</summary>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 16 }}>{result.code || result.review_packet?.code}</pre>
      </details>
      <details><summary>Validation, execution, comparison and cost (raw)</summary>
        <pre style={{ overflow: 'auto' }}>{JSON.stringify(result.review_packet || result, null, 2)}</pre>
      </details>
    </>}
    {!result && error && <p role="alert" style={{ color: '#a00' }}>{error}</p>}
  </main>;
}
