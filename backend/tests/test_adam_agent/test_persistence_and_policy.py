import pytest
from app.modules.adam_agent.checkpoints import PersistentSqliteSaver
from app.modules.adam_agent.workflow import AdamAgent
from app.modules.adam_agent.components import ReplayGenerator
from .test_workflow import SequenceValidator, CsvExecutor, REF_ROWS

class TokenReplay(ReplayGenerator):
    async def generate(self, *args, **kwargs):
        result = await super().generate(*args, **kwargs)
        result.prompt_tokens = 100
        result.completion_tokens = 20
        return result

@pytest.mark.asyncio
async def test_review_survives_restart(tmp_path, small_spec):
    path = tmp_path / "checkpoints.sqlite"
    ref = tmp_path / "reference.csv"
    import pandas as pd
    pd.DataFrame(REF_ROWS).to_csv(ref, index=False)
    saver = PersistentSqliteSaver(path)
    first = AdamAgent(TokenReplay(["adsl <- dm"]), SequenceValidator([]), CsvExecutor([REF_ROWS]),
                      checkpointer=saver, work_root=tmp_path / "runs", require_verification=True)
    started = await first.start(small_spec, tmp_path, ref, requested_by="developer")
    assert started.status == "awaiting_review"
    saver.close()
    second_saver = PersistentSqliteSaver(path)
    second = AdamAgent(ReplayGenerator(["unused"]), SequenceValidator([]), CsvExecutor([REF_ROWS]),
                       checkpointer=second_saver, work_root=tmp_path / "runs", require_verification=True)
    assert second.get_state(started.run_id)["awaiting_review"]
    final = await second.review(started.run_id, "approve", reviewer="reviewer")
    assert final.status == "approved"
    assert final.state["cost"] == started.state["cost"]
    second_saver.close()

@pytest.mark.asyncio
async def test_strict_mode_rejects_missing_execution_and_reference(tmp_path, small_spec):
    agent = AdamAgent(ReplayGenerator(["adsl <- dm"]), SequenceValidator([]),
                      work_root=tmp_path, require_verification=True)
    with pytest.raises(ValueError, match="executor"):
        await agent.start(small_spec, tmp_path)
    agent.executor = CsvExecutor([REF_ROWS])
    with pytest.raises(ValueError, match="reference"):
        await agent.start(small_spec, tmp_path)

@pytest.mark.asyncio
async def test_strict_mode_cannot_approve_failed_quality_gate(tmp_path, small_spec):
    import pandas as pd
    ref = tmp_path/"ref.csv"
    pd.DataFrame(REF_ROWS).to_csv(ref,index=False)
    agent = AdamAgent(ReplayGenerator(["bad"]), SequenceValidator([False]),
                      CsvExecutor([REF_ROWS]), work_root=tmp_path, require_verification=True)
    pending = await agent.start(small_spec,tmp_path,ref,max_attempts=1)
    with pytest.raises(ValueError,match="verification"):
        await agent.review(pending.run_id,"approve",reviewer="qc")

def test_langchain_offsets_and_size():
    from app.modules.studies.text_chunker import TextChunker
    text = "Alpha beta gamma.\n\n" * 30
    chunks = TextChunker(70,10).chunk_text(text)
    assert len(chunks)>1
    for chunk in chunks:
        assert text[chunk["start_pos"]:chunk["end_pos"]] == chunk["text"]
        assert len(chunk["text"])<=70

def test_embeddings_fail_closed_without_real_model(monkeypatch):
    from app.modules.studies.embedding_service import EmbeddingService
    service=EmbeddingService.__new__(EmbeddingService)
    service.model=None
    monkeypatch.delenv("EMBEDDING_ALLOW_HASH_FALLBACK", raising=False)
    with pytest.raises(RuntimeError,match="semantic"):
        service.generate_embedding("clinical protocol")
