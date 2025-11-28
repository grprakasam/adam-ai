"""
File Locking Utilities for Concurrent SDTM Generation

Implements cross-platform file locking to prevent race conditions when
multiple requests write to the same metadata.json file.
"""

import os
import time
import asyncio
from pathlib import Path
from contextlib import contextmanager
from typing import Optional
from loguru import logger

# Platform-specific imports
try:
    # Unix/Linux file locking
    import fcntl
    HAS_FCNTL = True
except ImportError:
    # Windows doesn't have fcntl
    HAS_FCNTL = False

try:
    # Windows file locking
    import msvcrt
    HAS_MSVCRT = True
except ImportError:
    # Unix doesn't have msvcrt
    HAS_MSVCRT = False


class FileLockError(Exception):
    """Exception raised when file lock cannot be acquired"""
    pass


class FileLock:
    """
    Cross-platform file locking for preventing concurrent writes.

    Supports both Unix (fcntl) and Windows (msvcrt) file locking.
    """

    def __init__(self, file_path: Path, timeout: int = 10):
        """
        Initialize file lock.

        Args:
            file_path: Path to file to lock
            timeout: Maximum seconds to wait for lock (default: 10)
        """
        self.file_path = Path(file_path)
        self.lock_file_path = self.file_path.with_suffix(self.file_path.suffix + '.lock')
        self.timeout = timeout
        self.lock_file_handle: Optional[any] = None

    def acquire(self) -> bool:
        """
        Acquire file lock.

        Returns:
            True if lock acquired, False otherwise

        Raises:
            FileLockError: If lock cannot be acquired within timeout
        """
        start_time = time.time()

        while True:
            try:
                # Create lock file (exclusive creation)
                # Open with write mode to get file handle for locking
                self.lock_file_handle = open(self.lock_file_path, 'w')

                if HAS_FCNTL:
                    # Unix file locking
                    fcntl.flock(self.lock_file_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    logger.debug(f"Acquired lock (fcntl): {self.lock_file_path}")
                    return True

                elif HAS_MSVCRT:
                    # Windows file locking
                    msvcrt.locking(
                        self.lock_file_handle.fileno(),
                        msvcrt.LK_NBLCK,
                        1
                    )
                    logger.debug(f"Acquired lock (msvcrt): {self.lock_file_path}")
                    return True

                else:
                    # Fallback: simple lock file existence check (not atomic, but better than nothing)
                    logger.warning("No file locking mechanism available, using basic lock file")
                    return True

            except (IOError, OSError, BlockingIOError) as e:
                # Lock is held by another process
                if self.lock_file_handle:
                    self.lock_file_handle.close()
                    self.lock_file_handle = None

                # Check timeout
                elapsed = time.time() - start_time
                if elapsed >= self.timeout:
                    logger.error(
                        f"Failed to acquire lock within {self.timeout}s: {self.lock_file_path}"
                    )
                    raise FileLockError(
                        f"Could not acquire lock for {self.file_path} within {self.timeout} seconds"
                    )

                # Wait before retry
                time.sleep(0.1)

    def release(self):
        """Release file lock"""
        if self.lock_file_handle:
            try:
                if HAS_FCNTL:
                    # Unix unlock
                    fcntl.flock(self.lock_file_handle.fileno(), fcntl.LOCK_UN)

                elif HAS_MSVCRT:
                    # Windows unlock
                    msvcrt.locking(
                        self.lock_file_handle.fileno(),
                        msvcrt.LK_UNLCK,
                        1
                    )

                self.lock_file_handle.close()
                self.lock_file_handle = None

                # Remove lock file
                if self.lock_file_path.exists():
                    try:
                        self.lock_file_path.unlink()
                    except OSError:
                        pass  # Lock file may already be removed

                logger.debug(f"Released lock: {self.lock_file_path}")

            except Exception as e:
                logger.error(f"Error releasing lock: {e}")

    def __enter__(self):
        """Context manager entry"""
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.release()


@contextmanager
def file_lock(file_path: Path, timeout: int = 10):
    """
    Context manager for file locking.

    Usage:
        with file_lock(metadata_file):
            # Safely write to file
            with open(metadata_file, 'w') as f:
                json.dump(data, f)

    Args:
        file_path: Path to file to lock
        timeout: Maximum seconds to wait for lock

    Yields:
        FileLock instance
    """
    lock = FileLock(file_path, timeout=timeout)
    try:
        lock.acquire()
        yield lock
    finally:
        lock.release()


class AsyncFileLock:
    """
    Async version of FileLock for use in FastAPI endpoints.
    """

    def __init__(self, file_path: Path, timeout: int = 10):
        """
        Initialize async file lock.

        Args:
            file_path: Path to file to lock
            timeout: Maximum seconds to wait for lock
        """
        self.file_lock = FileLock(file_path, timeout=timeout)

    async def acquire(self) -> bool:
        """
        Acquire file lock asynchronously.

        Returns:
            True if lock acquired

        Raises:
            FileLockError: If lock cannot be acquired within timeout
        """
        # Run blocking acquire in thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.file_lock.acquire)

    async def release(self):
        """Release file lock asynchronously"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.file_lock.release)

    async def __aenter__(self):
        """Async context manager entry"""
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.release()


@contextmanager
async def async_file_lock(file_path: Path, timeout: int = 10):
    """
    Async context manager for file locking.

    Usage:
        async with async_file_lock(metadata_file):
            # Safely write to file
            async with aiofiles.open(metadata_file, 'w') as f:
                await f.write(json.dumps(data))

    Args:
        file_path: Path to file to lock
        timeout: Maximum seconds to wait for lock

    Yields:
        AsyncFileLock instance
    """
    lock = AsyncFileLock(file_path, timeout=timeout)
    try:
        await lock.acquire()
        yield lock
    finally:
        await lock.release()
