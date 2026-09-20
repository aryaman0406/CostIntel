"""
CostIntel — Rate Limiting Middleware
Protects critical endpoints (auth, registration, chat, AI agents) from abuse,
brute-force attacks, and denial of service under high concurrent traffic.
"""

import time
import threading
from functools import wraps
from flask import request
from utils.response import error_response

# Thread-safe in-memory sliding window rate tracker
_rate_limits = {}
_lock = threading.Lock()

def rate_limit(max_requests=60, window_seconds=60):
    """
    Rate limit decorator.
    
    Args:
        max_requests: Maximum number of allowed requests in the time window.
        window_seconds: Time window duration in seconds.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Key by client IP address and endpoint name
            client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown")
            if "," in client_ip:
                client_ip = client_ip.split(",")[0].strip()
            
            key = f"{client_ip}:{request.endpoint}"
            now = time.time()

            with _lock:
                # Get request timestamps for this key
                timestamps = _rate_limits.get(key, [])
                
                # Filter timestamps within current window
                cutoff = now - window_seconds
                timestamps = [t for t in timestamps if t > cutoff]

                if len(timestamps) >= max_requests:
                    retry_after = int(window_seconds - (now - timestamps[0])) + 1
                    response = error_response(
                        f"Too many requests. Please retry in {retry_after} seconds.",
                        429,
                        error_code="RATE_LIMIT_EXCEEDED"
                    )
                    response[0].headers["Retry-After"] = str(retry_after)
                    return response

                # Record current request
                timestamps.append(now)
                _rate_limits[key] = timestamps

            return fn(*args, **kwargs)
        return wrapper
    return decorator
