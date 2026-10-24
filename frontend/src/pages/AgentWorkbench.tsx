import { useState } from 'react';
import axios from 'axios';

const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const auth = () => ({ Authorization: 'Bearer ' + (localStorage.getItem('adam_access_token') || '') });
export default function AgentWorkbench() {
  const [spec, setSpec] = useState('dataset: ADSL\nkeys: [USUBJID]\nsdtm_domains: [dm]\nvariables:\n  - name: USUBJID');
  const [sdtm, setSdtm] = useState('benchmarks/pharmaverse/data/sdtm');
  const [reference, setReference] = useState('benchmarks/pharmaverse/data/reference/adsl.csv');
  const [runId, setRunId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
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
    }, { headers: auth() }))}>Generate and verify</button>
    <hr />
    <label>Run ID <input value={runId} onChange={e => setRunId(e.target.value)} /></label>
    <button disabled={busy || !runId} onClick={() => request(() => axios.get(api + '/runs/' + encodeURIComponent(runId), { headers: auth() }))}>Load run</button>
    {result && <>
      <h2>{result.status || (result.awaiting_review ? 'Awaiting review' : 'Run details')}</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 16 }}>{result.code || result.review_packet?.code}</pre>
      <details open><summary>Validation, execution, comparison and cost</summary>
        <pre style={{ overflow: 'auto' }}>{JSON.stringify(result.review_packet || result, null, 2)}</pre>
      </details>
      {(result.status === 'awaiting_review' || result.awaiting_review) && <>
        <label>Review comment <input value={comment} onChange={e => setComment(e.target.value)} /></label>
        {(['approve', 'reject'] as const).map(decision => <button key={decision} disabled={busy}
          onClick={() => request(() => axios.post(api + '/runs/' + encodeURIComponent(runId) + '/review',
            { decision, comment }, { headers: auth() }))}>{decision === 'approve' ? 'Approve verified output' : 'Reject output'}</button>)}
      </>}
    </>}
    {error && <p role="alert" style={{ color: '#a00' }}>{error}</p>}
  </main>;
}
