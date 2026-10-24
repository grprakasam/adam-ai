"""Disk-backed, single-host checkpoints supporting sync inspection and async graph execution."""
import asyncio
import sqlite3
from pathlib import Path
from langgraph.checkpoint.sqlite import SqliteSaver

class PersistentSqliteSaver(SqliteSaver):
    def __init__(self, path):
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        super().__init__(sqlite3.connect(str(target), check_same_thread=False))
        self.setup()

    async def aget_tuple(self, config):
        return await asyncio.to_thread(self.get_tuple, config)

    async def aput(self, config, checkpoint, metadata, new_versions):
        return await asyncio.to_thread(self.put, config, checkpoint, metadata, new_versions)

    async def aput_writes(self, config, writes, task_id, task_path=""):
        return await asyncio.to_thread(self.put_writes, config, writes, task_id, task_path)

    async def alist(self, config, *, filter=None, before=None, limit=None):
        rows = await asyncio.to_thread(lambda: list(self.list(config, filter=filter, before=before, limit=limit)))
        for row in rows:
            yield row

    def close(self):
        self.conn.close()
