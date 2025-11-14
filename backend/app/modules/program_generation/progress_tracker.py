"""
Progress Tracker - Real-time progress updates for code generation
"""

from typing import Callable, Optional
from datetime import datetime
from loguru import logger


class ProgressTracker:
    """Tracks and reports progress during code generation"""

    def __init__(self, total_steps: int, callback: Optional[Callable] = None):
        """
        Initialize progress tracker

        Args:
            total_steps: Total number of steps in the process
            callback: Optional callback function to call on progress updates
        """
        self.total_steps = total_steps
        self.current_step = 0
        self.callback = callback
        self.start_time = datetime.now()
        self.step_history = []

    def update(self, step_name: str, progress_pct: float):
        """
        Update progress

        Args:
            step_name: Name of the current step
            progress_pct: Progress percentage (0-100)
        """
        self.current_step += 1
        elapsed = (datetime.now() - self.start_time).total_seconds()

        status = {
            "step": step_name,
            "progress": min(progress_pct, 100),  # Cap at 100%
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "elapsed_seconds": elapsed,
            "estimated_remaining": self._estimate_remaining(progress_pct, elapsed)
        }

        self.step_history.append({
            "step": step_name,
            "timestamp": datetime.now(),
            "progress": progress_pct
        })

        logger.info(f"Progress update: {step_name} ({progress_pct:.1f}%)")

        if self.callback:
            try:
                self.callback(status)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")

    def _estimate_remaining(self, progress_pct: float, elapsed: float) -> Optional[float]:
        """
        Estimate remaining time based on current progress

        Args:
            progress_pct: Current progress percentage
            elapsed: Elapsed time in seconds

        Returns:
            Estimated remaining time in seconds, or None if cannot estimate
        """
        if progress_pct <= 0 or progress_pct >= 100:
            return None

        # Estimate based on linear progression
        estimated_total = (elapsed / progress_pct) * 100
        remaining = estimated_total - elapsed

        return max(remaining, 0)  # Ensure non-negative

    def complete(self):
        """Mark the process as complete"""
        total_time = (datetime.now() - self.start_time).total_seconds()

        status = {
            "step": "Complete",
            "progress": 100,
            "current_step": self.total_steps,
            "total_steps": self.total_steps,
            "elapsed_seconds": total_time,
            "estimated_remaining": 0
        }

        logger.info(f"Process completed in {total_time:.2f} seconds")

        if self.callback:
            try:
                self.callback(status)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")

        return total_time

    def get_summary(self) -> dict:
        """Get progress summary"""
        return {
            "total_steps": self.total_steps,
            "completed_steps": self.current_step,
            "total_time": (datetime.now() - self.start_time).total_seconds(),
            "step_history": self.step_history
        }
