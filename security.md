# Security Architecture & Bot Mitigation Strategy

This document outlines the potential security bottlenecks in the application and details strategies to identify, treat, and block malicious bots and actors.

## 1. Security Bottlenecks & Vulnerabilities

### A. Authentication & Authorization Risks
- **Brute Force Attacks**: Attackers attempting to guess user passwords repeatedly.
- **Credential Stuffing**: Using stolen credentials from other breaches to gain access.
- **Session Hijacking**: Stealing validity tokens to impersonate users.
- **Privilege Escalation**: Users accessing admin-level resources without improved permissions.

### B. API & Infrastructure Risks
- **DDoS (Distributed Denial of Service)**: Overwhelming the server with traffic to take it offline.
- **Rate Limit Abuse**: Excessive API calls degrading performance for legitimate users.
- **Data Scraping**: Bots harvesting sensitive user data or content.
- **Man-in-the-Middle (MitM) Attacks**: Intercepting unencrypted communication.

### C. Input & Data Handling
- **SQL Injection (SQLi)**: Malicious SQL queries injected via input fields.
- **Cross-Site Scripting (XSS)**: Injecting malicious scripts into frontend views.
- **Unrestricted File Uploads**: Uploading executable files or malware (e.g., via the evidence upload feature).

---

## 2. Bot Identification & Blocking Strategy

We will implement a multi-layered defense system to detect and block bots.

### Phase 1: Identification (Detection)

1.  **Behavioral Analysis**:
    *   Monitor request frequency (e.g., >100 requests/minute from a single IP).
    *   Analyze navigation patterns (bots often hit endpoints directly without loading frontend assets).
    *   Check for impossible travel (user logging in from India and USA within 5 minutes).

2.  **Fingerprinting**:
    *   **User-Agent Analysis**: Identify scripts (e.g., `python-requests`, `curl`, `headless-chrome`) versus legitimate browsers.
    *   **JA3 Fingerprinting**: Analyze SSL/TLS handshake patterns to identify non-browser clients.

3.  **Honeypots**:
    *   Add hidden form fields (CSS `display: none`) that are invisible to humans but visible to bots. If filled, the request is immediately flagged as malicious.

### Phase 2: Treatment & Blocking (Response)

1.  **Rate Limiting (Token Bucket Algorithm)**:
    *   **Global Limit**: 1000 req/min for the entire app.
    *   **Per-IP Limit**: 60 req/min typically, 5 req/min for sensitive endpoints like `/login`.
    *   **Action**: Return `429 Too Many Requests` status code.

2.  **CAPTCHA Challenges**:
    *   Integrate **Cloudflare Turnstile** or **Google reCAPTCHA v3**.
    *   **Logic**:
        *   Trust Score > 0.7: Allow request.
        *   Trust Score 0.3 - 0.7: Show visual puzzle.
        *   Trust Score < 0.3: Block request specifically.

3.  **IP Blacklisting**:
    *   Automatically ban IPs for 24 hours if they trigger >5 failed login attempts or hit non-existent endpoints (scanning) repeatedly.

4.  **WAF (Web Application Firewall)**:
    *   Deploy Cloudflare or AWS WAF in front of the application to block known malicious IP ranges and prevent SQLi/XSS payloads before they reach the backend.

---

## 3. Solution Implementation Roadmap

### Immediate Actions (Backend - Python/FastAPI)

1.  **Update `security.py` & `deps.py`**:
    *   Implement strictly enforced Rate Limiting using `slowapi` or Redis.
    *   Validate all incoming data with Pydantic schemas (done, but ensure strictness).

2.  **Secure File Uploads (`uploads.py`)**:
    *   **File Type Validation**: Check "Magic Bytes" (file signature) not just extensions.
    *   **Sanitization**: Rename files to random UUIDs to prevent directory traversal.
    *   **Size Limits**: Enforce strict max file size (e.g., 10MB).

3.  **Frontend Protection (React/Vite)**:
    *   Add **Cloudflare Turnstile** widget to Login/Signup forms.
    *   Sanitize all user-generated content using libraries like `DOMPurify` before rendering to prevent XSS.

### Architecture Diagram (Conceptual)

```mermaid
graph TD
    User((User/Bot)) --> WAF[Cloudflare WAF / Anti-DDoS]
    WAF -- Legitimate --> LB[Load Balancer]
    WAF -- Malicious --> Block[Block Request]
    LB --> RateLimit[Rate Limiter (Redis)]
    RateLimit -- Pass --> Server[FastAPI Backend]
    RateLimit -- Exceed --> 429[429 Error]
    Server --> Auth[Auth Service]
    Server --> DB[(Database)]
```

## 4. Specific Code Solutions

### Rate Limiting Example (FastAPI)
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/login")
@limiter.limit("5/minute")
def login(request: Request):
    # Login logic
    pass
```

### Honeypot Example (Frontend)
```jsx
<form onSubmit={handleSubmit}>
  {/* Real fields */}
  <input type="text" name="username" />
  
  {/* Honeypot field - invisible to users */}
  <input 
    type="text" 
    name="bot_check" 
    style={{ display: 'none' }} 
    tabIndex={-1} 
    autoComplete="off"
  />
  
  <button type="submit">Login</button>
</form>
```
**Backend Check**: If `bot_check` has any value, reject the request immediately.
