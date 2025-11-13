"""
Batch Processing Service
Handles bulk code generation for multiple variables
"""

import asyncio
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
from loguru import logger


class BatchStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class BatchItem:
    """Single item in a batch"""
    id: str
    variable: str
    status: BatchStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "variable": self.variable,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


class BatchJob:
    """Represents a batch processing job"""
    
    def __init__(
        self,
        job_id: str,
        items: List[BatchItem],
        max_concurrent: int = 5
    ):
        self.job_id = job_id
        self.items = items
        self.max_concurrent = max_concurrent
        self.status = BatchStatus.PENDING
        self.created_at = datetime.now()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.progress = 0.0
    
    def get_progress(self) -> Dict[str, Any]:
        """Calculate job progress"""
        total = len(self.items)
        completed = sum(1 for item in self.items if item.status == BatchStatus.COMPLETED)
        failed = sum(1 for item in self.items if item.status == BatchStatus.FAILED)
        processing = sum(1 for item in self.items if item.status == BatchStatus.PROCESSING)
        pending = sum(1 for item in self.items if item.status == BatchStatus.PENDING)
        
        self.progress = (completed + failed) / total * 100 if total > 0 else 0
        
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "progress": round(self.progress, 2),
            "total": total,
            "completed": completed,
            "failed": failed,
            "processing": processing,
            "pending": pending,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }
    
    def to_dict(self) -> Dict:
        """Convert job to dictionary"""
        return {
            **self.get_progress(),
            "items": [item.to_dict() for item in self.items]
        }


class BatchProcessor:
    """
    Manages batch processing of multiple operations
    Supports concurrent processing with rate limiting
    """
    
    def __init__(self, max_concurrent: int = 5):
        self.max_concurrent = max_concurrent
        self.jobs: Dict[str, BatchJob] = {}
        self.semaphore = asyncio.Semaphore(max_concurrent)
        logger.info(f"BatchProcessor initialized with max_concurrent={max_concurrent}")
    
    async def process_batch(
        self,
        job_id: str,
        items: List[BatchItem],
        processor_func: Callable,
        **kwargs
    ) -> BatchJob:
        """
        Process a batch of items concurrently
        
        Args:
            job_id: Unique identifier for the batch job
            items: List of items to process
            processor_func: Async function to process each item
            **kwargs: Additional arguments to pass to processor_func
        
        Returns:
            BatchJob with results
        """
        job = BatchJob(job_id, items, self.max_concurrent)
        self.jobs[job_id] = job
        
        job.status = BatchStatus.PROCESSING
        job.started_at = datetime.now()
        
        logger.info(f"Starting batch job {job_id} with {len(items)} items")
        
        try:
            # Process items concurrently with semaphore limiting
            tasks = [
                self._process_item(item, processor_func, **kwargs)
                for item in items
            ]
            
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # Check if any items failed
            failed_count = sum(1 for item in items if item.status == BatchStatus.FAILED)
            
            job.status = BatchStatus.COMPLETED if failed_count == 0 else BatchStatus.FAILED
            job.completed_at = datetime.now()
            
            logger.info(
                f"Batch job {job_id} completed: "
                f"{len(items) - failed_count}/{len(items)} successful"
            )
        
        except Exception as e:
            job.status = BatchStatus.FAILED
            job.completed_at = datetime.now()
            logger.error(f"Batch job {job_id} failed: {str(e)}")
        
        return job
    
    async def _process_item(
        self,
        item: BatchItem,
        processor_func: Callable,
        **kwargs
    ) -> None:
        """Process a single item with rate limiting"""
        async with self.semaphore:
            item.status = BatchStatus.PROCESSING
            item.started_at = datetime.now()
            
            try:
                logger.debug(f"Processing item {item.id}: {item.variable}")
                
                # Call the processor function
                result = await processor_func(item, **kwargs)
                
                item.result = result
                item.status = BatchStatus.COMPLETED
                item.completed_at = datetime.now()
                
                logger.debug(f"Item {item.id} completed successfully")
            
            except Exception as e:
                item.status = BatchStatus.FAILED
                item.error = str(e)
                item.completed_at = datetime.now()
                logger.error(f"Item {item.id} failed: {str(e)}")
    
    def get_job(self, job_id: str) -> Optional[BatchJob]:
        """Get batch job by ID"""
        return self.jobs.get(job_id)
    
    def get_job_progress(self, job_id: str) -> Optional[Dict]:
        """Get progress for a specific job"""
        job = self.jobs.get(job_id)
        return job.get_progress() if job else None
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a batch job"""
        job = self.jobs.get(job_id)
        if job and job.status == BatchStatus.PROCESSING:
            job.status = BatchStatus.CANCELLED
            logger.info(f"Batch job {job_id} cancelled")
            return True
        return False
    
    def cleanup_old_jobs(self, hours: int = 24) -> int:
        """Remove jobs older than specified hours"""
        cutoff = datetime.now()
        old_jobs = [
            job_id for job_id, job in self.jobs.items()
            if job.completed_at and (cutoff - job.completed_at).total_seconds() > hours * 3600
        ]
        
        for job_id in old_jobs:
            del self.jobs[job_id]
        
        if old_jobs:
            logger.info(f"Cleaned up {len(old_jobs)} old batch jobs")
        
        return len(old_jobs)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get batch processor statistics"""
        return {
            "max_concurrent": self.max_concurrent,
            "active_jobs": len([j for j in self.jobs.values() if j.status == BatchStatus.PROCESSING]),
            "total_jobs": len(self.jobs),
            "jobs": {
                job_id: job.get_progress()
                for job_id, job in list(self.jobs.items())[:10]  # First 10 jobs
            }
        }


# Global batch processor instance
_batch_processor: Optional[BatchProcessor] = None


def get_batch_processor(max_concurrent: int = 5) -> BatchProcessor:
    """Get or create batch processor instance"""
    global _batch_processor
    if _batch_processor is None:
        _batch_processor = BatchProcessor(max_concurrent=max_concurrent)
    return _batch_processor
