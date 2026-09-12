"""Helpers to keep synchronous work off the asyncio event loop.

Hermes HUD collectors do synchronous sqlite3 / subprocess / filesystem
work. Calling them inline from ``async def`` route handlers runs that work
directly on the single asyncio event loop and stalls every other request
(measured: ``/api/plugins`` and ``/api/billing`` time out under load while
a trivial 404 takes ~17s). ``run_blocking`` offloads such calls to a worker
thread via ``asyncio.to_thread``, throttled by a small semaphore so a burst
of slow collectors cannot exhaust the default thread pool.

The semaphore is sized at 2 (not 1) so it throttles per-route collector
calls without serialising the dashboard's parallel fan-out, which calls
``asyncio.to_thread`` + ``asyncio.gather`` directly and never takes this
path.
"""

import asyncio

# At most 2 heavyweight collector threads run concurrently.
_heavy = asyncio.Semaphore(2)


async def run_blocking(fn, *args, **kwargs):
    """Run a synchronous callable in a worker thread, off the event loop."""
    async with _heavy:
        return await asyncio.to_thread(fn, *args, **kwargs)
