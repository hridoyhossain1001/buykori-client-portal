import os
import html
import secrets
import logging
import hashlib
import hmac
import time
from urllib.parse import urlencode
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import get_db
from app.models.client import Client
from app.models.audit_log import AuditLog
from app.security import encrypt_token
from app.services.webhook_service import _webhook_url_allowed
from app.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBasic()

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise RuntimeError("⛔ ADMIN_PASSWORD environment variable is required!")

CSRF_MAX_AGE_SECONDS = 60 * 60


def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    is_user_ok = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    is_pass_ok = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
    if not (is_user_ok and is_pass_ok):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


def create_admin_csrf_token(username: str) -> str:
    nonce = secrets.token_urlsafe(24)
    issued_at = str(int(time.time()))
    payload = f"{username}:{issued_at}:{nonce}"
    signature = hmac.new(
        ADMIN_PASSWORD.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{issued_at}:{nonce}:{signature}"


def verify_admin_csrf_token(token: str, username: str) -> None:
    try:
        issued_at, nonce, signature = token.split(":", 2)
        issued_ts = int(issued_at)
    except (AttributeError, TypeError, ValueError):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")

    if time.time() - issued_ts > CSRF_MAX_AGE_SECONDS:
        raise HTTPException(status_code=403, detail="Expired CSRF token")

    payload = f"{username}:{issued_at}:{nonce}"
    expected = hmac.new(
        ADMIN_PASSWORD.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")


# ─── HTML TEMPLATES ─────────────────────────────────────────────────────────



STYLE = """
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  :root {
    --bg-main: #131722;
    --bg-sidebar: #1a1e2d;
    --bg-card: #1e2233;
    --bg-card-hover: #23283c;
    --bg-soft: #272d42;
    --border: #2d3348;
    --primary: #4f46e5;
    --primary-hover: #6366f1;
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
    --info: #3b82f6;
    --sidebar-width: 250px;
    --header-height: 64px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }
  body {
    background: var(--bg-main);
    color: var(--text-main);
    min-height: 100vh;
    display: flex;
    overflow-x: hidden;
  }
  
  /* Sidebar */
  .sidebar {
    width: var(--sidebar-width);
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    position: fixed;
    height: 100vh;
    left: 0;
    top: 0;
    z-index: 50;
  }
  .brand {
    padding: 24px;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .brand span { font-weight: 400; color: var(--text-muted); font-size: 13px; display: block; margin-top: 4px; }
  .nav-menu { flex: 1; padding: 16px 12px; }
  .nav-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; margin-bottom: 4px;
    color: var(--text-muted); font-size: 14px; font-weight: 500;
    text-decoration: none; border-radius: 8px;
    transition: all 0.2s;
  }
  .nav-item:hover { background: rgba(255,255,255,0.05); color: #fff; }
  .nav-item.active { background: rgba(255,255,255,0.1); color: #fff; }
  .nav-item.bottom { margin-top: auto; }
  .sidebar-bottom { padding: 16px 12px; border-top: 1px solid rgba(255,255,255,0.05); }

  /* Main Content */
  .main-wrapper {
    flex: 1;
    margin-left: var(--sidebar-width);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* Header */
  .topbar {
    height: var(--header-height);
    background: var(--bg-main);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32px;
    position: sticky;
    top: 0;
    z-index: 40;
  }
  .search-box {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 16px;
    width: 320px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .search-box input {
    background: none; border: none; outline: none; color: #fff; font-size: 13px; width: 100%;
  }
  .search-box input::placeholder { color: var(--text-muted); }
  .topbar-right { display: flex; align-items: center; gap: 20px; }
  .env-badge { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
  .user-profile { display: flex; align-items: center; gap: 12px; }
  .user-avatar { width: 32px; height: 32px; background: var(--bg-soft); border-radius: 50%; overflow: hidden; border: 1px solid var(--border); }
  .user-info { display: flex; flex-direction: column; }
  .user-info .name { font-size: 13px; font-weight: 600; color: #fff; }
  .user-info .role { font-size: 11px; color: var(--text-muted); }
  .icon-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; position: relative; }
  .icon-btn:hover { color: #fff; }
  .notification-dot { position: absolute; top: 0; right: 0; width: 6px; height: 6px; background: var(--danger); border-radius: 50%; }

  /* Content Container */
  .content { padding: 32px; }

  /* Page Header */
  .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
  .page-title { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 6px; }
  .page-sub { font-size: 14px; color: var(--text-muted); }
  .header-actions { display: flex; gap: 12px; }
  .btn { padding: 9px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; border: 1px solid transparent; }
  .btn-outline { background: transparent; border-color: var(--border); color: #fff; }
  .btn-outline:hover { background: rgba(255,255,255,0.05); }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-primary:hover { background: var(--primary-hover); }

  /* Metrics Grid */
  .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px; }
  .metric-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; position: relative; overflow: hidden; }
  .metric-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
  .metric-title { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .metric-icon { width: 32px; height: 32px; background: var(--bg-soft); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--text-muted); border: 1px solid rgba(255,255,255,0.05); }
  .metric-value { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 12px; line-height: 1.1; }
  .metric-trend { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); }
  .trend-up { background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 6px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .trend-down { background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 2px 6px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .trend-neutral { background: rgba(255, 255, 255, 0.1); color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }

  /* Main Layout Grid */
  .layout-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start; }

  /* Cards */
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .card-header { padding: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .card-title { font-size: 16px; font-weight: 600; color: #fff; }
  .card-actions { display: flex; gap: 8px; }

  /* Tables */
  .table-responsive { width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 14px 20px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02); }
  td { padding: 16px 20px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  tr:last-child td { border-bottom: none; }
  
  .client-name { font-weight: 600; color: #fff; }
  .client-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .code-text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: var(--text-muted); }

  /* Badges */
  .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; }
  .badge-healthy { background: rgba(16, 185, 129, 0.1); color: #34d399; border-color: rgba(16, 185, 129, 0.2); }
  .badge-degraded { background: rgba(239, 68, 68, 0.1); color: #f87171; border-color: rgba(239, 68, 68, 0.2); }
  .badge-healthy::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #34d399; }
  .badge-degraded::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #f87171; }

  /* Activity Stream */
  .log-list { padding: 0; }
  .log-item { display: grid; grid-template-columns: 60px 50px 1fr; gap: 12px; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 12px; }
  .log-item:last-child { border-bottom: none; }
  .log-time { color: var(--text-muted); font-family: ui-monospace, monospace; }
  .log-tag { font-family: ui-monospace, monospace; font-weight: 600; }
  .log-tag.info { color: #34d399; }
  .log-tag.warn { color: #facc15; }
  .log-tag.err { color: #f87171; }
  .log-msg { color: #cbd5e1; line-height: 1.4; }

  /* Utility & Inputs */
  .api-key-cell { font-family: monospace; font-size: 12px; color: #cbd5e1; background: #0b1220; border: 1px solid var(--border); padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; max-width: 180px; }
  .copy-icon { background: none; border: none; color: var(--text-muted); cursor: pointer; }
  .copy-icon:hover { color: #fff; }
  .btn-sm { padding: 6px 12px; font-size: 11px; border-radius: 4px; border: 1px solid transparent; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; text-decoration: none; }
  .btn-info { background: rgba(59, 130, 246, 0.1); color: #60a5fa; border-color: rgba(59, 130, 246, 0.2); }
  .btn-info:hover { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
  .btn-danger { background: rgba(239, 68, 68, 0.1); color: #f87171; border-color: rgba(239, 68, 68, 0.2); }
  .btn-danger:hover { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }

  .alert { padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
  .alert-success { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: #34d399; }
  .alert-error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; }

  /* Form Inputs for Add Client */
  .form-group { margin-bottom: 16px; }
  .form-group label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; }
  .form-group input[type=text], .form-group input[type=password], .form-group input[type=number] { width: 100%; padding: 10px 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; }
  .form-group input:focus { border-color: var(--primary); }
  .hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  .btn-full { width: 100%; justify-content: center; padding: 12px; }

  /* Misc */
  .instr-box { background: #0b1220; border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-family: ui-monospace, monospace; font-size: 12px; color: #dbeafe; white-space: pre-wrap; word-break: break-all; margin-top: 8px; }
  .copy-btn { background: #4f46e5; color: #fff; border: 1px solid #6366f1; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; float: right; margin-top: 12px; margin-right: 8px; }

  @media (max-width: 1024px) {
    .layout-grid { grid-template-columns: 1fr; }
    .metrics-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); }
    .main-wrapper { margin-left: 0; }
    .metrics-grid { grid-template-columns: 1fr; }
    .search-box { display: none; }
  }
  /* Restored classes for Instructions Page */
  .icon { width: 32px; height: 32px; background: rgba(99, 102, 241, 0.14); border: 1px solid rgba(129, 140, 248, 0.22); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; margin-right: 8px; vertical-align: middle; }
  .left-col { flex: 1; }
  .right-col { width: 100%; max-width: 400px; }
  .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow-x: auto; }
  .tab-btn { background: transparent; border: 1px solid transparent; color: var(--text-muted); font-size: 14px; font-weight: 700; cursor: pointer; padding: 8px 12px; border-radius: 8px; transition: all 0.2s; white-space: nowrap; }
  .tab-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
  .tab-btn.active { color: #fff; background: rgba(99, 102, 241, 0.16); border-color: rgba(99, 102, 241, 0.32); }
  .tab-content { display: none; animation: fadeIn 0.3s ease; }
  .tab-content.active { display: block; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

</style>
"""



def base_html(title: str, body: str, msg: str = "", msg_type: str = "success", active_page: str = "dashboard") -> str:
    alert_html = ""
    safe_title = html.escape(title, quote=True)
    if msg:
        safe_msg = html.escape(msg)
        safe_type = "error" if msg_type == "error" else "success"
        alert_html = f'<div class="alert alert-{safe_type}"><span>{safe_msg}</span></div>'

    def nav_active(page):
        return "active" if active_page == page else ""
    
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{safe_title} — CAPI Gateway</title>
  {STYLE}
</head>
<body>

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="brand">
      CAPIGateway
      <span>Enterprise Admin</span>
    </div>
    <div class="nav-menu">
      <a href="/api/v1/admin" class="nav-item {nav_active("dashboard")}">
        <span style="font-size:16px">🎛️</span> Dashboard
      </a>
      <a href="/api/v1/admin/clients" class="nav-item {nav_active("clients")}">
        <span style="font-size:16px">👥</span> Clients
      </a>
      <a href="/api/v1/admin/logs" class="nav-item {nav_active("logs")}">
        <span style="font-size:16px">📡</span> API Logs
      </a>
      <a href="/api/v1/admin/settings" class="nav-item {nav_active("settings")}">
        <span style="font-size:16px">⚙️</span> Settings
      </a>
    </div>
    <div class="sidebar-bottom">
      <a href="#" class="nav-item" onclick="alert('Support Ticket')">
        <span style="font-size:16px">🎧</span> Support Ticket
      </a>
      <a href="#" class="nav-item" onclick="if(confirm('Log out?')) window.location='/api/v1/admin'">
        <span style="font-size:16px">🚪</span> Log Out
      </a>
    </div>
  </aside>

  <!-- Main Content Area -->
  <div class="main-wrapper">
    <!-- Topbar -->
    <header class="topbar">
      <div class="search-box">
        <span>🔍</span>
        <input type="text" placeholder="Search events, clients, IPs...">
      </div>
      <div class="topbar-right">
        <div style="display:flex;align-items:center;gap:12px;border-right:1px solid var(--border);padding-right:20px;">
          <span style="font-size:12px;font-weight:600;color:var(--text-muted)">ENV</span>
          <span class="env-badge">PRODUCTION</span>
        </div>
        <button class="icon-btn">
          🔔 <span class="notification-dot"></span>
        </button>
        <button class="icon-btn">❓</button>
        <div class="user-profile">
          <div class="user-avatar" style="background:#2d3748 url(\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22%2394a3b8%22%3E%3Cpath stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z%22/%3E%3C/svg%3E\') no-repeat center center / 60%;">&nbsp;</div>
          <div class="user-info">
            <span class="name">Admin Panel</span>
            <span class="role">sysop@capigateway</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Page Content -->
    <main class="content">
      {alert_html}
      {body}
    </main>
  </div>

<script>
function copyText(id){{
  var t = document.getElementById(id);
  var value = t.dataset.secret || t.innerText || t.value;
  navigator.clipboard.writeText(value);
  if (event && event.target) {{
    var old = event.target.innerText;
    event.target.innerText = 'Copied!';
    setTimeout(()=>event.target.innerText=old || 'Copy',1500);
  }}
}}
function revealSecret(id){{
  var t = document.getElementById(id);
  if (!t || !t.dataset.secret) return;
  var hidden = t.dataset.hidden !== '0';
  t.innerText = hidden ? t.dataset.secret : t.dataset.masked;
  t.dataset.hidden = hidden ? '0' : '1';
}}
setTimeout(() => {{
  const alert = document.querySelector('.alert');
  if (alert) {{
    alert.style.opacity = '0';
    alert.style.transition = 'opacity 0.5s ease';
    setTimeout(() => alert.style.display = 'none', 500);
  }}
}}, 5000);
</script>
</body>
</html>'''


def admin_redirect(msg: str, msg_type: str = "success") -> RedirectResponse:
    query = urlencode({"msg": msg, "msg_type": msg_type})
    return RedirectResponse(url=f"/api/v1/admin?{query}", status_code=303)


def mask_secret(value: str | None, prefix: int = 6, suffix: int = 4) -> str:
    if not value:
        return ""
    if len(value) <= prefix + suffix:
        return "•" * len(value)
    return f"{value[:prefix]}{'•' * 12}{value[-suffix:]}"


def request_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


async def log_admin_action(
    db: AsyncSession,
    request: Request,
    actor: str,
    action: str,
    client_id: int | None = None,
    details: str | None = None,
) -> None:
    db.add(
        AuditLog(
            actor=actor,
            action=action,
            client_id=client_id,
            ip_address=request_ip(request),
            details=details,
        )
    )


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@router.get("/admin", response_class=HTMLResponse, include_in_schema=False)
@limiter.limit("10/minute")
async def admin_dashboard(
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    msg: str = "",
    msg_type: str = "success",
):
    csrf_token = create_admin_csrf_token(username)
    result = await db.execute(select(Client).order_by(Client.created_at.desc()))
    clients = result.scalars().all()
    active_count = sum(1 for c in clients if c.is_active)

    audit_r = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(12))
    audit_logs = audit_r.scalars().all()

    # ─── Event Analytics Query ────────────────────────────────────────────
    from datetime import datetime, timezone
    from sqlalchemy import func as sql_func, and_
    from app.models.event_log import EventLog
    from app.models.failed_event import FailedEvent

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # আজকের সফল ইভেন্ট (Global)
    success_r = await db.execute(
        select(sql_func.coalesce(sql_func.sum(EventLog.event_count), 0)).where(
            and_(EventLog.status == "success", EventLog.created_at >= today)
        )
    )
    events_today = success_r.scalar() or 0

    # প্রতি ক্লায়েন্টের আজকের সফল ইভেন্ট
    client_events_r = await db.execute(
        select(EventLog.client_id, sql_func.coalesce(sql_func.sum(EventLog.event_count), 0))
        .where(and_(EventLog.status == "success", EventLog.created_at >= today))
        .group_by(EventLog.client_id)
    )
    client_events_map = {row[0]: row[1] for row in client_events_r}

    # আজকের ব্যর্থ (SUM ব্যবহার করো — একটি row-তে একাধিক ইভেন্ট থাকতে পারে)
    fail_r = await db.execute(
        select(sql_func.coalesce(sql_func.sum(EventLog.event_count), 0)).where(
            and_(EventLog.status == "failed", EventLog.created_at >= today)
        )
    )
    failed_today = fail_r.scalar() or 0

    # Pending retries
    retry_r = await db.execute(
        select(sql_func.count(FailedEvent.id)).where(
            FailedEvent.status.in_(["pending", "retrying"])
        )
    )
    retries = retry_r.scalar() or 0

    total_calls = events_today + failed_today
    success_rate = round(events_today / total_calls * 100, 1) if total_calls > 0 else 100.0

    # ─── New Dashboard Layout ─────────────────────────────────────────────────────────────
    # System Overview
    header_html = f'''
    <div class="page-header">
      <div>
        <h1 class="page-title">System Overview</h1>
        <p class="page-sub">Real-time metrics for CAPI integrations and event routing.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline">📅 Last 24 Hours</button>
        <button class="btn btn-primary" onclick="alert('Export functionality coming soon')">📥 Export Report</button>
      </div>
    </div>
    '''

    # Metrics Grid
    match_rate = f"{success_rate}%"
    error_rate = "0.00%" if total_calls == 0 else f"{(failed_today / total_calls * 100):.2f}%"

    metrics_html = f'''
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Events Processed</span>
          <span class="metric-icon">🔄</span>
        </div>
        <div class="metric-value">{events_today:,}</div>
        <div class="metric-trend"><span class="trend-up">↗ 12.4%</span> vs prev 24h</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Match Rate Average</span>
          <span class="metric-icon">🎯</span>
        </div>
        <div class="metric-value">{match_rate}</div>
        <div class="metric-trend"><span class="trend-up">↗ 1.2%</span> vs prev 24h</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Error Rate / Drops</span>
          <span class="metric-icon" style="color:var(--danger);border-color:rgba(239,68,68,0.2);background:rgba(239,68,68,0.1)">⚠</span>
        </div>
        <div class="metric-value">{error_rate}</div>
        <div class="metric-trend"><span class="trend-down">↘ 0.01%</span> vs prev 24h</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Active Connections</span>
          <span class="metric-icon">📶</span>
        </div>
        <div class="metric-value">{active_count:,}</div>
        <div class="metric-trend"><span class="trend-neutral">− 0%</span> Steady</div>
      </div>
    </div>
    '''

    # ─── Add Client Form ───────────────────────────────────────────────────
    add_form = f'''
    <div class="card" style="margin-top:24px;">
      <div class="card-header"><h2 class="card-title"><span class="icon">➕</span> নতুন ক্লায়েন্ট যোগ করুন</h2></div>
      <div style="padding: 20px;">
        <form method="post" action="/api/v1/admin/add-client">
          <input type="hidden" name="csrf_token" value="{csrf_token}">
          <div class="layout-grid" style="grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
            <div>
              <div class="form-group">
                <label>ক্লায়েন্টের নাম</label>
                <input type="text" name="name" placeholder="যেমন: ABC Ecommerce" required>
              </div>
              <div class="form-group">
                <label>Facebook Pixel ID</label>
                <input type="text" name="pixel_id" placeholder="1234567890" required>
                <div class="hint">FB Events Manager → Settings → Pixel ID</div>
              </div>
              <div class="form-group">
                <label>CAPI Access Token</label>
                <input type="text" name="access_token" placeholder="EAAxxxx..." required>
                <div class="hint">Events Manager → Settings → Conversions API → Generate Access Token</div>
              </div>
              <div class="form-group">
                <label>Website Domain (সিকিউরিটির জন্য)</label>
                <input type="text" name="domain" placeholder="buykori.me">
                <div class="hint">🔒 এই ডোমেইন ছাড়া অন্য কেউ API Key ব্যবহার করতে পারবে না। খালি রাখলে সব ডোমেইন থেকে কাজ করবে।</div>
              </div>
              <div class="form-group">
                <label>Test Event Code (Optional)</label>
                <input type="text" name="test_event_code" placeholder="TEST12345">
                <div class="hint">শুধু টেস্টিং করার সময় দিন, লাইভে খালি রাখুন</div>
              </div>
            </div>
            
            <div>
              <div style="border-bottom:1px solid var(--border);margin-bottom:16px;padding-bottom:8px">
                <div style="font-size:13px;color:#9575cd;font-weight:600">🎵 TikTok CAPI (Optional)</div>
              </div>
              <div class="form-group">
                <label>TikTok Pixel ID</label>
                <input type="text" name="tiktok_pixel_id" placeholder="C1234567890">
              </div>
              <div class="form-group">
                <label>TikTok Access Token</label>
                <input type="text" name="tiktok_access_token" placeholder="">
              </div>
              
              <div style="border-bottom:1px solid var(--border);margin-bottom:16px;margin-top:20px;padding-bottom:8px">
                <div style="font-size:13px;color:#00a1f1;font-weight:600">📊 GA4 Server-Side (Optional)</div>
              </div>
              <div class="form-group">
                <label>GA4 Measurement ID</label>
                <input type="text" name="ga4_measurement_id" placeholder="G-XXXXXXXXXX">
              </div>
              <div class="form-group">
                <label>GA4 API Secret</label>
                <input type="text" name="ga4_api_secret" placeholder="">
              </div>
              
              <div style="margin-top:20px;">
                <div class="form-group">
                  <label style="display:flex;align-items:center;gap:10px;cursor:pointer;color:#fff;font-weight:600">
                    <input type="checkbox" name="deferred_purchase" value="1" style="width:18px;height:18px;accent-color:#7e57c2;cursor:pointer;">
                    🔄 Deferred Purchase সচল করুন
                  </label>
                  <div class="hint">সচল করলে Purchase event সরাসরি Facebook-এ যাবে না — অর্ডার কনফার্ম হলে তবেই যাবে। COD ব্যবসার জন্য পারফেক্ট!</div>
                </div>
                <div class="form-group" style="margin-top:16px;">
                  <label>Custom Webhook URL (Outbound)</label>
                  <input type="text" name="webhook_url" placeholder="https://your-server.com/webhook">
                  <div class="hint">প্রতিটি event fire হলে এই URL-এ data forward হবে (CRM, Zapier, etc.)</div>
                </div>
              </div>
            </div>
          </div>
          <div style="margin-top: 20px; text-align: right; border-top: 1px solid var(--border); padding-top: 20px;">
            <button type="submit" class="btn btn-primary">✅ ক্লায়েন্ট যোগ করুন</button>
          </div>
        </form>
      </div>
    </div>
    '''

    # Client Table
    if clients:
        rows = ""
        for c in clients:
            status_badge = '<span class="badge badge-healthy">Healthy</span>' if c.is_active else '<span class="badge badge-degraded">Degraded</span>'
            toggle_action = "deactivate" if c.is_active else "activate"
            toggle_label = "❌ Deactivate" if c.is_active else "✅ Activate"
            safe_name = html.escape(c.name)
            safe_pixel = html.escape(c.pixel_id)
            safe_key = html.escape(c.api_key, quote=True)
            import html as htmllib
            def mask_secret_func(val):
                if not val: return ""
                if len(val) <= 10: return "•" * len(val)
                return f"{val[:6]}{'•' * 12}{val[-4:]}"
            safe_key_masked = htmllib.escape(mask_secret_func(c.api_key))
            c_events = client_events_map.get(c.id, 0)
            
            rows += f'''
            <tr>
              <td>
                <div class="client-name">{safe_name}</div>
                <div class="client-sub">{safe_pixel}</div>
              </td>
              <td>{status_badge}</td>
              <td class="code-text" style="color:#10b981;font-weight:600;">{c_events:,}</td>
              <td>
                <div class="api-key-cell">
                  <span id="client_key_{c.id}" data-secret="{safe_key}" data-masked="{safe_key_masked}" data-hidden="1">{safe_key_masked}</span>
                  <button class="copy-icon" onclick="copyText('client_key_{c.id}')" title="Copy API Key">📋</button>
                </div>
              </td>
              <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <a href="/api/v1/admin/client/{c.id}/instructions" class="btn-sm btn-info">📋 Instructions</a>
                    <form method="post" action="/api/v1/admin/client/{c.id}/{toggle_action}" style="margin:0">
                      <input type="hidden" name="csrf_token" value="{csrf_token}">
                      <button type="submit" class="btn-sm btn-danger">{toggle_label}</button>
                    </form>
                    <form method="post" action="/api/v1/admin/client/{c.id}/rotate-portal-key" style="margin:0" onsubmit="return confirm('Rotate portal login key?')">
                      <input type="hidden" name="csrf_token" value="{csrf_token}">
                      <button type="submit" class="btn-sm btn-info">Rotate Portal</button>
                    </form>
                </div>
              </td>
            </tr>'''
            
        client_table = f'''
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Active Client Integrations</h2>
            <div class="card-actions">
              <button class="icon-btn">🔍</button>
              <button class="icon-btn">⚙️</button>
            </div>
          </div>
          <div class="table-responsive">
            <table>
              <thead><tr>
                <th>Client ID</th><th>Status</th><th>Events (24h)</th>
                <th>API Key</th><th>Actions</th>
              </tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        </div>'''
    else:
        client_table = '''
        <div class="card">
          <div class="card-header"><h2 class="card-title">Active Client Integrations</h2></div>
          <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
            <div style="font-size:32px; margin-bottom:12px;">📭</div>
            <p>No active client integrations found.</p>
          </div>
        </div>'''

    # Admin Activity Stream
    if audit_logs:
        audit_rows = ""
        for log in audit_logs:
            safe_actor = html.escape(log.actor or "system")
            safe_action = html.escape(log.action or "unknown")
            created = log.created_at.strftime("%H:%M:%S") if log.created_at else "00:00:00"
            
            tag_class = "info"
            tag_text = "[INFO]"
            if "error" in safe_action or "fail" in safe_action:
                tag_class = "err"
                tag_text = "[ERR]"
            elif "warning" in safe_action or "deactivate" in safe_action:
                tag_class = "warn"
                tag_text = "[WARN]"
                
            audit_rows += f'''
            <div class="log-item">
              <div class="log-time">{created}</div>
              <div class="log-tag {tag_class}">{tag_text}</div>
              <div class="log-msg">User <b>{safe_actor}</b> performed <i>{safe_action}</i></div>
            </div>'''
            
        audit_table = f'''
        <div class="card">
          <div class="card-header">
            <h2 class="card-title" style="display:flex;align-items:center;gap:8px">
               <span>📋</span> Admin Activity Stream
            </h2>
          </div>
          <div class="log-list">
            {audit_rows}
          </div>
        </div>'''
    else:
        audit_table = '''
        <div class="card">
          <div class="card-header"><h2 class="card-title">Admin Activity Stream</h2></div>
          <div style="padding: 20px; color: var(--text-muted); font-size: 13px;">No recent activity.</div>
        </div>'''

    body = f'''
    {header_html}
    {metrics_html}
    <div class="layout-grid">
      <div class="left-col">{client_table}</div>
      <div class="right-col">{audit_table}</div>
    </div>
    
    {add_form}
    '''
    return HTMLResponse(base_html("Dashboard", body, msg, msg_type))


@router.post("/admin/add-client", include_in_schema=False)
@limiter.limit("10/minute")
async def add_client(
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    name: str = Form(...),
    pixel_id: str = Form(...),
    access_token: str = Form(...),
    test_event_code: str = Form(None),
    domain: str = Form(None),
    tiktok_pixel_id: str = Form(None),
    tiktok_access_token: str = Form(None),
    ga4_measurement_id: str = Form(None),
    ga4_api_secret: str = Form(None),
    deferred_purchase: str = Form(None),
    webhook_url: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)

    # ─── Input Validation ──────────────────────────────────────────────────
    name = name.strip()
    pixel_id = pixel_id.strip()
    access_token = access_token.strip()

    errors = []
    if not name or len(name) > 100:
        errors.append("নাম ১-১০০ অক্ষরের মধ্যে হতে হবে।")
    if not pixel_id.isdigit():
        errors.append("Pixel ID শুধু সংখ্যা হতে হবে।")
    if len(access_token) < 10:
        errors.append("Access Token কমপক্ষে ১০ অক্ষরের হতে হবে।")

    if errors:
        error_msg = " | ".join(errors)
        return admin_redirect(error_msg, "error")

    clean_webhook_url = webhook_url.strip() if webhook_url and webhook_url.strip() else None
    if clean_webhook_url:
        parsed_webhook = urlparse(clean_webhook_url)
        if parsed_webhook.scheme not in ("https", "http") or not parsed_webhook.netloc:
            return admin_redirect("Webhook URL must be a valid http(s) URL.", "error")
        if not _webhook_url_allowed(clean_webhook_url):
            return admin_redirect("Webhook URL is not allowed. Use a public http(s) endpoint.", "error")

    # Domain sanitize — https://, http://, trailing slash সরাও
    clean_domain = None
    if domain and domain.strip():
        clean_domain = domain.strip().lower()
        for prefix in ["https://", "http://", "www."]:
            clean_domain = clean_domain.removeprefix(prefix)
        clean_domain = clean_domain.rstrip("/")

    new_client = Client(
        name=name,
        pixel_id=pixel_id,
        access_token=encrypt_token(access_token),  # 🔐 Encrypted at rest
        test_event_code=test_event_code.strip() if test_event_code else None,
        domain=clean_domain,
        api_key=secrets.token_urlsafe(32),
        public_key=secrets.token_urlsafe(24),
        portal_key=secrets.token_urlsafe(24),
        tiktok_pixel_id=tiktok_pixel_id.strip() if tiktok_pixel_id and tiktok_pixel_id.strip() else None,
        tiktok_access_token=encrypt_token(tiktok_access_token.strip()) if tiktok_access_token and tiktok_access_token.strip() else None,
        ga4_measurement_id=ga4_measurement_id.strip() if ga4_measurement_id and ga4_measurement_id.strip() else None,
        ga4_api_secret=encrypt_token(ga4_api_secret.strip()) if ga4_api_secret and ga4_api_secret.strip() else None,
        deferred_purchase=deferred_purchase == "1",
        webhook_url=clean_webhook_url,
    )
    db.add(new_client)
    await db.commit()
    await db.refresh(new_client)
    await log_admin_action(db, request, username, "client.added", new_client.id, f"Client {name} added")
    await db.commit()
    logger.info(f"New client added: {name}")

    return admin_redirect(f"✅ {name} সফলভাবে যোগ হয়েছে!")


@router.get("/admin/client/{client_id}/instructions", response_class=HTMLResponse, include_in_schema=False)
async def client_instructions(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Base URL detection
    base_url = str(request.base_url).rstrip("/")

    endpoint = f"{base_url}/api/v1/events"
    tracker_key = getattr(client, "public_key", None) or client.api_key
    tracker_url = f"{base_url}/t.js?key={tracker_key}"
    safe_client_name = html.escape(client.name, quote=True)
    safe_api_key = html.escape(client.api_key, quote=True)
    safe_portal_key = html.escape(getattr(client, "portal_key", None) or client.api_key, quote=True)
    safe_public_key = html.escape(getattr(client, "public_key", None) or "", quote=True)
    masked_api_key = html.escape(mask_secret(client.api_key))
    masked_portal_key = html.escape(mask_secret(getattr(client, "portal_key", None) or client.api_key))
    masked_public_key = html.escape(mask_secret(getattr(client, "public_key", None) or ""))
    safe_endpoint = html.escape(endpoint, quote=True)
    safe_tracker_url = html.escape(tracker_url, quote=True)
    safe_capi_origin = html.escape(
        f"https://{client.domain}" if client.domain else "https://your-domain.com",
        quote=True,
    )

    body = f"""
    <h1 class="page-title">📋 Client Instructions</h1>
    <p class="page-sub">এই পেজটি <strong>{safe_client_name}</strong>-কে পাঠিয়ে দিন অথবা নিজেই সেটআপ করুন</p>

    <div class="card" style="margin-bottom:20px">
      <div class="card-title"><span class="icon">🔑</span> আপনার API Key</div>
      <p style="color:#888;font-size:13px;margin-bottom:10px">এই Key-টি গোপন রাখুন। কখনো Browser/JS-এ পাবলিকলি রাখবেন না। শুধু সার্ভার বা GTM থেকে ব্যবহার করুন।</p>
      <button class="copy-btn" onclick="copyText('api_key')">Copy</button>
      <button class="copy-btn" onclick="revealSecret('api_key')" style="margin-right:6px">Show</button>
      <div class="instr-box" id="api_key" data-secret="{safe_api_key}" data-masked="{masked_api_key}" data-hidden="1">{masked_api_key}</div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-title"><span class="icon">🔐</span> Client Portal Login Key</div>
      <p style="color:#888;font-size:13px;margin-bottom:10px">Client Portal login-এর জন্য এই আলাদা key ব্যবহার করুন। API Key শুধু server/plugin request-এর জন্য রাখুন।</p>
      <button class="copy-btn" onclick="copyText('portal_key')">Copy</button>
      <button class="copy-btn" onclick="revealSecret('portal_key')" style="margin-right:6px">Show</button>
      <div class="instr-box" id="portal_key" data-secret="{safe_portal_key}" data-masked="{masked_portal_key}" data-hidden="1">{masked_portal_key}</div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-title"><span class="icon">Keys</span> Key Management</div>
      <p style="color:#888;font-size:13px;margin-bottom:12px">Key rotate করলে পুরনো key সঙ্গে সঙ্গে invalid হবে। আগে staging/client setup update করে নিন।</p>
      <div class="instr-box" id="public_key" data-secret="{safe_public_key}" data-masked="{masked_public_key}" data-hidden="1">{masked_public_key}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <form method="post" action="/api/v1/admin/client/{client.id}/rotate-api-key" onsubmit="return confirm('Rotate server API key? Plugin/server integrations must be updated.')">
          <input type="hidden" name="csrf_token" value="{create_admin_csrf_token(username)}">
          <button type="submit" class="btn-sm btn-danger">Rotate API Key</button>
        </form>
        <form method="post" action="/api/v1/admin/client/{client.id}/rotate-public-key" onsubmit="return confirm('Rotate browser tracker public key? t.js URLs must be updated.')">
          <input type="hidden" name="csrf_token" value="{create_admin_csrf_token(username)}">
          <button type="submit" class="btn-sm btn-info">Rotate Public Key</button>
        </form>
        <form method="post" action="/api/v1/admin/client/{client.id}/rotate-portal-key" onsubmit="return confirm('Rotate client portal login key?')">
          <input type="hidden" name="csrf_token" value="{create_admin_csrf_token(username)}">
          <button type="submit" class="btn-sm btn-info">Rotate Portal Key</button>
        </form>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-title"><span class="icon">🌐</span> CAPI Endpoint URL</div>
      <p style="color:#888;font-size:13px;margin-bottom:6px">সব ইভেন্ট এই URL-এ POST করতে হবে।</p>
      <button class="copy-btn" onclick="copyText('endpoint')">Copy</button>
      <div class="instr-box" id="endpoint">{safe_endpoint}</div>
      <div style="margin-top:12px;padding:10px 14px;background:rgba(126,87,194,0.08);border:1px solid rgba(126,87,194,0.2);border-radius:8px;font-size:12px;color:#9575cd;">
        💡 <strong>Custom Domain:</strong> আপনার নিজের ডোমেইন থাকলে (যেমন: <code>capi.yourdomain.com</code>) Heroku URL-এর বদলে সেটি ব্যবহার করুন।
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="openTab(event, 'tab-gtm')">⚙️ GTM Server</button>
      <button class="tab-btn" onclick="openTab(event, 'tab-generator')">🛠️ Event Generator</button>
      <button class="tab-btn" onclick="openTab(event, 'tab-wp')">📝 WordPress</button>
      <button class="tab-btn" onclick="openTab(event, 'tab-custom')">💻 Custom</button>
      <button class="tab-btn" onclick="openTab(event, 'tab-test')">🧪 Testing</button>
    </div>

    <!-- GTM TAB -->
    <div id="tab-gtm" class="tab-content active card" style="margin-bottom:20px">
      <div class="card-title"><span class="icon">⚙️</span> GTM Server Container Setup <span style="font-size:12px;color:#00e676;margin-left:8px;">✅ Recommended</span></div>
      <div style="color:#aaa;font-size:14px;line-height:1.8">
        <p><strong style="color:#fff">Step 1:</strong> Google Tag Manager-এ <strong>Server Container</strong> তৈরি করুন।</p><br>
        <p><strong style="color:#fff">Step 2:</strong> নতুন <strong>Tag → HTTP Request</strong> তৈরি করুন।</p><br>
        <p><strong style="color:#fff">Step 3:</strong> নিচের সেটিংস দিন:</p>
        <button class="copy-btn" onclick="copyText('gtm_settings')" style="margin-bottom:4px">Copy</button>
        <div class="instr-box" id="gtm_settings">URL: {safe_endpoint}
Method: POST
Content-Type: application/json

Headers:
  X-API-Key: {safe_api_key}
  X-CAPI-Origin: {safe_capi_origin}

Body (JSON):
{{
  "data": [{{
    "event_name": "{{{{Event Name}}}}",
    "event_time": "{{{{timestamp}}}}",
    "event_id": "{{{{Event ID}}}}",
    "action_source": "website",
    "event_source_url": "{{{{Page URL}}}}",
    "user_data": {{
      "client_ip_address": "{{{{Client IP}}}}",
      "client_user_agent": "{{{{User Agent}}}}",
      "fbp": "{{{{FBP Cookie}}}}",
      "fbc": "{{{{FBC Cookie}}}}"
    }}
  }}]
}}</div>
        <br>
        <p><strong style="color:#fff">Step 4:</strong> Trigger — <strong>All Events</strong> বা নির্দিষ্ট ইভেন্ট সেট করুন।</p>
        <div style="margin-top:12px;padding:14px;background:rgba(0,230,118,0.05);border:1px solid rgba(0,230,118,0.15);border-radius:8px;font-size:13px;color:#aaa;line-height:1.9">
          <strong style="color:#00e676">💡 Pro Tips:</strong><br>
          • <strong style="color:#fff">event_id</strong> অবশ্যই ইউনিক হতে হবে — যেমন: <code>order-12345-1715000000</code><br>
          • Browser Pixel ও Server Pixel-এ <strong>একই event_id</strong> পাঠান (Deduplication)<br>
          • <code>action_source: "website"</code> সবসময় রাখুন
        </div>
      </div>
    </div>

    <!-- GENERATOR TAB -->
    <div id="tab-generator" class="tab-content card" style="margin-bottom:20px">
      <div class="card-title"><span class="icon">🛠️</span> Event Code Generator</div>
      
      <div style="margin-bottom:20px;padding:14px;background:rgba(255,82,82,0.1);border:1px solid rgba(255,82,82,0.3);border-radius:8px;font-size:13px;color:#ff5252;line-height:1.6">
        <strong>⚠️ সতর্কতা (Warning):</strong><br>
        দয়া করে শুধুমাত্র সেই ইভেন্টগুলোই ওয়েবসাইটে যুক্ত করুন যেগুলো আপনার ব্যবসার জন্য সত্যিই প্রয়োজন (যেমন: Purchase, AddToCart, Lead)। অপ্রয়োজনীয় ইভেন্ট যোগ করলে আপনার প্রতিদিনের ইভেন্ট লিমিট খুব দ্রুত শেষ হয়ে যাবে!
      </div>

      <div class="form-group" style="margin-bottom: 16px;">
        <label style="color:#fff; font-size:14px; margin-bottom:8px; display:block;">Select an Event to Generate Code:</label>
        <select id="event_selector" style="width:100%; padding:12px; background:rgba(0,0,0,0.4); border:1px solid var(--border); color:#fff; border-radius:8px; font-size:14px; outline:none;">
          <option value="page_view">page_view (পেজ ভিউ)</option>
          <option value="session_start">session_start (সেশন শুরু)</option>
          <option value="user_signup">user_signup / register (অ্যাকাউন্ট তৈরি)</option>
          <option value="user_login">user_login (লগইন)</option>
          <option value="user_logout">user_logout (লগআউট)</option>
          <option value="view_item">view_item (প্রোডাক্ট দেখা)</option>
          <option value="add_to_cart">add_to_cart (কার্টে যোগ করা)</option>
          <option value="remove_from_cart">remove_from_cart (কার্ট থেকে বাদ দেওয়া)</option>
          <option value="view_cart">view_cart (কার্ট দেখা)</option>
          <option value="begin_checkout">begin_checkout (চেকআউট শুরু)</option>
          <option value="purchase">purchase / order_completed (ক্রয় সম্পন্ন)</option>
          <option value="search">search (সার্চ)</option>
          <option value="form_submit">form_submit (ফর্ম জমা)</option>
          <option value="lead">lead (লিড জেনারেট)</option>
          <option value="subscription">subscription (সাবস্ক্রিপশন)</option>
          <option value="refund">refund (রিফান্ড)</option>
          <option value="error">error (এরর)</option>
          <option value="api_call">api_call (API কল)</option>
        </select>
      </div>

      <button class="btn" onclick="generateEventCode()" style="background:#00e676; color:#000; margin-bottom:20px;">⚡ Generate Code</button>

      <div id="code_result_area" style="display:none;">
        <p style="color:#00e676; font-size:13px; margin-bottom:8px;">✅ আপনার কোড রেডি! এটি ওয়েবসাইটের Header-এ বা বাটনের ক্লিকের সাথে বসান:</p>
        <button class="copy-btn" onclick="copyText('generated_code_box')" style="margin-bottom:4px">Copy</button>
        <div class="instr-box" id="generated_code_box" style="min-height:80px;"></div>
      </div>
    </div>

    <!-- WORDPRESS TAB -->
    <div id="tab-wp" class="tab-content card" style="margin-bottom:20px">
      <div class="card-title"><span class="icon">📝</span> WordPress Setup (সবচেয়ে সহজ নিয়ম)</div>
      <div style="color:#aaa;font-size:14px;line-height:1.8">
        <p><strong style="color:#fff">ধাপ ১:</strong> আপনার WordPress ওয়েবসাইটে লগিন করুন।</p>
        <p><strong style="color:#fff">ধাপ ২:</strong> <code>WPCode</code> নামের ফ্রি প্লাগিনটি ইনস্টল এবং এক্টিভেট করুন।</p>
        <p><strong style="color:#fff">ধাপ ৩:</strong> WPCode থেকে "Header & Footer" অপশনে যান।</p>
        <p><strong style="color:#fff">ধাপ ৪:</strong> "Header" বক্সে নিচের কোডটি কপি করে পেস্ট করুন এবং Save দিন:</p>
        <button class="copy-btn" onclick="copyText('wp_pv_easy')" style="margin-bottom:4px">Copy</button>
        <div class="instr-box" id="wp_pv_easy">&lt;script src="{safe_tracker_url}" defer&gt;&lt;/script&gt;

&lt;!-- অথবা সরাসরি: --&gt;
&lt;script src="{safe_tracker_url}" defer&gt;&lt;/script&gt;</div>
        
        <div style="margin-top:16px;padding:14px;background:rgba(0,230,118,0.05);border:1px solid rgba(0,230,118,0.15);border-radius:8px;font-size:13px;color:#aaa;line-height:1.9">
          <strong style="color:#00e676">🎉 অভিনন্দন!</strong><br>
          আপনার ওয়েবসাইটে পেজ-ভিউ ট্র্যাকিং চালু হয়ে গেছে! এখন কেউ আপনার ওয়েবসাইটে আসলে আপনি তা দেখতে পাবেন।
        </div>
        
        <br><br>
        <p><strong style="color:#fff">ধাপ ৫ (সবগুলো ইকমার্স ইভেন্ট একসাথে ট্র্যাক করতে):</strong></p>
        <p>Purchase, AddToCart, ViewContent (প্রোডাক্ট দেখা) এবং Checkout ট্র্যাক করতে WPCode-এর "Add Snippet"-এ গিয়ে "Add Your Custom Code" সিলেক্ট করুন। Code Type দিন "PHP Snippet" এবং নিচের ম্যাজিক কোডটি পেস্ট করে "Active" করে সেভ দিন। ব্যাস, আপনার পুরো স্টোর ট্র্যাকিং শুরু হয়ে যাবে!</p>
        <button class="copy-btn" onclick="copyText('wp_all_easy')" style="margin-bottom:4px">Copy</button>
        <div class="instr-box" id="wp_all_easy">&lt;?php
// ১. Purchase Event
add_action('woocommerce_thankyou', 'send_capi_purchase_easy');
function send_capi_purchase_easy($order_id) {{
    $order = wc_get_order($order_id);
    send_capi_event('Purchase', $order-&gt;get_checkout_url(), $order-&gt;get_total(), "order-" . $order_id, null);
}}

// ২. ViewContent (Product View)
add_action('woocommerce_after_single_product', 'send_capi_view_content');
function send_capi_view_content() {{
    global $product;
    send_capi_event('ViewContent', get_permalink(), $product-&gt;get_price(), 'view-' . $product-&gt;get_id(), $product-&gt;get_id());
}}

// ৩. AddToCart
add_action('woocommerce_add_to_cart', 'send_capi_add_to_cart', 10, 2);
function send_capi_add_to_cart($cart_item_key, $product_id) {{
    $product = wc_get_product($product_id);
    send_capi_event('AddToCart', wc_get_cart_url(), $product-&gt;get_price(), 'cart-' . $product_id, $product_id);
}}

// ৪. InitiateCheckout
add_action('woocommerce_before_checkout_form', 'send_capi_checkout');
function send_capi_checkout() {{
    send_capi_event('InitiateCheckout', wc_get_checkout_url(), WC()-&gt;cart-&gt;get_cart_contents_total(), 'chk-' . time(), null);
}}

// Main Function to Send Data
function send_capi_event($event_name, $url, $value, $event_id, $product_id) {{
    $data = ['data' =&gt; [[
        'event_name' =&gt; $event_name,
        'event_time' =&gt; time(),
        'event_id' =&gt; $event_id,
        'event_source_url' =&gt; $url,
        'action_source' =&gt; 'website',
        'user_data' =&gt; [
            'client_ip_address' =&gt; $_SERVER['REMOTE_ADDR'] ?? '',
            'client_user_agent' =&gt; $_SERVER['HTTP_USER_AGENT'] ?? ''
        ],
        'custom_data' =&gt; [
            'value' =&gt; (float) $value,
            'currency' =&gt; get_woocommerce_currency()
        ]
    ]]];
    
    if ($product_id) {{
        $data['data'][0]['custom_data']['content_ids'] = [$product_id];
        $data['data'][0]['custom_data']['content_type'] = 'product';
    }}

    wp_remote_post('{safe_endpoint}', [
        'body' => json_encode($data),
        'headers' => [
            'Content-Type' => 'application/json',
            'X-API-Key' => '{safe_api_key}',
            'X-CAPI-Origin' => '{safe_capi_origin}'
        ],
        'blocking' => false
    ]);
}}
?&gt;</div>
      </div>
    </div>

    <!-- CUSTOM TAB -->
    <div id="tab-custom" class="tab-content card" style="margin-bottom:20px">
      <div class="card-title"><span class="icon">💻</span> Custom Backend (cURL / Node / Laravel / Python)</div>
      <div style="color:#aaa;font-size:14px;line-height:1.8">
        <p><strong style="color:#fff">cURL Example (Purchase):</strong></p>
        <button class="copy-btn" onclick="copyText('curl_ex')" style="margin-bottom:4px">Copy</button>
        <div class="instr-box" id="curl_ex">curl -X POST "{safe_endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: $CAPI_API_KEY" \\
  -H "X-CAPI-Origin: {safe_capi_origin}" \\
  -d '{{
    "data": [{{
      "event_name": "Purchase",
      "event_time": 1715000000,
      "event_id": "order-12345-1715000000",
      "action_source": "website",
      "event_source_url": "https://example.com/checkout/success",
      "user_data": {{
        "client_ip_address": "192.168.1.1",
        "client_user_agent": "Mozilla/5.0...",
        "fbp": "fb.1.1715000000.1234567890",
        "fbc": "fb.1.1715000000.9876543210"
      }},
      "custom_data": {{
        "value": 150.50,
        "currency": "BDT"
      }}
    }}]
  }}'</div>
        <div style="margin-top:12px;padding:14px;background:rgba(0,230,118,0.05);border:1px solid rgba(0,230,118,0.15);border-radius:8px;font-size:13px;color:#aaa;line-height:1.9">
          <strong style="color:#00e676">🔒 Security:</strong><br>
          • API Key সবসময় <code>.env</code> থেকে লোড করুন — <code>$CAPI_API_KEY</code><br>
          • Email/Phone পাঠালে <strong>SHA-256 Hash</strong> করে পাঠান। IP ও UA হ্যাশ করতে হবে না।
        </div>
      </div>
    </div>

    <!-- TESTING TAB -->
    <div id="tab-test" class="tab-content card" style="margin-bottom:20px">
      <div class="card-title"><span class="icon">🧪</span> Testing Guide — লাইভের আগে টেস্ট করুন</div>
      <div style="color:#aaa;font-size:14px;line-height:2">
        <p><strong style="color:#fff">Step 1:</strong> Facebook Events Manager → আপনার Pixel → <strong>Test Events</strong> ট্যাবে যান → Test Code কপি করুন।</p><br>
        <p><strong style="color:#fff">Step 2:</strong> Admin Dashboard → ক্লায়েন্ট Edit → <strong>Test Event Code</strong> ফিল্ডে Code দিন।</p><br>
        <p><strong style="color:#fff">Step 3:</strong> আপনার ওয়েবসাইট ব্রাউজ করুন বা GTM থেকে ইভেন্ট ট্রিগার করুন।</p><br>
        <p><strong style="color:#fff">Step 4:</strong> Facebook Events Manager-এর Test Events ট্যাবে রিয়েল-টাইমে ইভেন্ট দেখা যাবে।</p><br>
        <p><strong style="color:#fff">Step 5:</strong> সব ঠিক থাকলে Admin Panel থেকে Test Event Code খালি করে দিন।</p><br>
        <div style="padding:14px;background:rgba(255,82,82,0.06);border:1px solid rgba(255,82,82,0.2);border-radius:8px;font-size:13px;color:#aaa;line-height:1.9">
          <strong style="color:#ff5252">⚠️ Checklist:</strong><br>
          ✅ প্রতিটি ইভেন্টে ইউনিক <code>event_id</code> যাচ্ছে কিনা<br>
          ✅ Browser ও Server Pixel-এ একই <code>event_id</code> যাচ্ছে কিনা<br>
          ✅ <code>_fbp</code> ও <code>_fbc</code> কুকি পাঠানো হচ্ছে কিনা<br>
          ✅ Match Rate ৬০%+ আছে কিনা (Events Manager-এ দেখুন)
        </div>
      </div>
    </div>

    <!-- IMPORTANT NOTES -->
    <div class="card">
      <div class="card-title"><span class="icon">📌</span> Important Notes</div>
      <ul style="color:#aaa;font-size:13px;line-height:2.2;padding-left:20px">
        <li>ইউনিক <strong style="color:#fff">event_id</strong> ব্যবহার করুন — <code>order-12345-1715000000</code></li>
        <li>Browser ও Server Pixel-এ <strong>একই event_id</strong> পাঠান (Deduplication)</li>
        <li><code>_fbc</code> ও <code>_fbp</code> কুকি পাঠালে Match Rate বাড়ে</li>
        <li>API Key কখনো Client-side এ রাখবেন না — শুধু Server থেকে</li>
        <li>সবসময় <code>"action_source": "website"</code> যোগ করুন</li>
        <li>লাইভের আগে <strong>Test Event Code</strong> দিয়ে ভেরিফাই করুন</li>
      </ul>
    </div>

    <br>
    <a href="/api/v1/admin" style="color:#6c63ff;font-size:14px">← Dashboard-এ ফিরে যান</a>

    <script>
    function openTab(evt, tabId) {{
      var i, tc, tl;
      tc = document.getElementsByClassName("tab-content");
      for (i = 0; i < tc.length; i++) {{ tc[i].className = tc[i].className.replace(" active", ""); }}
      tl = document.getElementsByClassName("tab-btn");
      for (i = 0; i < tl.length; i++) {{ tl[i].className = tl[i].className.replace(" active", ""); }}
      document.getElementById(tabId).className += " active";
      evt.currentTarget.className += " active";
    }}
    
    function generateEventCode() {{
        var ev = document.getElementById('event_selector').value;
        var code = "";
        var fbEvent = "";
        var params = "";
        
        switch(ev) {{
            case 'page_view': fbEvent = 'PageView'; break;
            case 'session_start': fbEvent = 'PageView'; params = ", {{custom_event: 'session_start'}}"; break;
            case 'user_signup': fbEvent = 'CompleteRegistration'; break;
            case 'user_login': fbEvent = 'Login'; break;
            case 'user_logout': fbEvent = 'Logout'; params = ", {{custom_event: 'user_logout'}}"; break;
            case 'view_item': fbEvent = 'ViewContent'; params = ", {{value: 100, currency: 'BDT', content_ids: ['ID-123'], content_type: 'product'}}"; break;
            case 'add_to_cart': fbEvent = 'AddToCart'; params = ", {{value: 100, currency: 'BDT', content_ids: ['ID-123']}}"; break;
            case 'remove_from_cart': fbEvent = 'RemoveFromCart'; params = ", {{value: 100, currency: 'BDT', content_ids: ['ID-123']}}"; break;
            case 'view_cart': fbEvent = 'ViewCart'; params = ", {{value: 500, currency: 'BDT'}}"; break;
            case 'begin_checkout': fbEvent = 'InitiateCheckout'; params = ", {{value: 500, currency: 'BDT'}}"; break;
            case 'purchase': fbEvent = 'Purchase'; params = ", {{value: 1500, currency: 'BDT', content_ids: ['ID-123'], order_id: 'ORD-001'}}"; break;
            case 'search': fbEvent = 'Search'; params = ", {{search_string: 'T-shirt'}}"; break;
            case 'form_submit': fbEvent = 'Contact'; break;
            case 'lead': fbEvent = 'Lead'; break;
            case 'subscription': fbEvent = 'Subscribe'; params = ", {{value: 500, currency: 'BDT'}}"; break;
            case 'refund': fbEvent = 'Refund'; params = ", {{value: 1500, currency: 'BDT', order_id: 'ORD-001'}}"; break;
            case 'error': fbEvent = 'Error'; params = ", {{error_msg: 'Payment failed'}}"; break;
            case 'api_call': fbEvent = 'API_Call'; params = ", {{endpoint: '/pay'}}"; break;
        }}
        
        code = "<script>\\n  // Event: " + ev + "\\n  capi('track', '" + fbEvent + "'" + params + ");\\n</scr" + "ipt>";
        
        document.getElementById('generated_code_box').innerText = code;
        document.getElementById('code_result_area').style.display = 'block';
    }}
    </script>
    """
    return HTMLResponse(base_html(f"Instructions — {client.name}", body))


async def rotate_client_key(
    db: AsyncSession,
    request: Request,
    username: str,
    client_id: int,
    key_type: str,
) -> RedirectResponse:
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    old_api_key = client.api_key
    if key_type == "api":
        client.api_key = secrets.token_urlsafe(32)
        message = "API key rotated. Update WordPress plugin/server integrations."
        action = "client.api_key_rotated"
    elif key_type == "public":
        client.public_key = secrets.token_urlsafe(24)
        message = "Public tracker key rotated. Update t.js script URLs."
        action = "client.public_key_rotated"
    elif key_type == "portal":
        client.portal_key = secrets.token_urlsafe(24)
        message = "Portal login key rotated."
        action = "client.portal_key_rotated"
    else:
        raise HTTPException(status_code=400, detail="Invalid key type")

    await log_admin_action(db, request, username, action, client_id)
    await db.commit()

    from app.dependencies import clear_client_cache
    clear_client_cache(old_api_key)

    return admin_redirect(message)


@router.post("/admin/client/{client_id}/rotate-api-key", include_in_schema=False)
async def rotate_api_key(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)
    return await rotate_client_key(db, request, username, client_id, "api")


@router.post("/admin/client/{client_id}/rotate-public-key", include_in_schema=False)
async def rotate_public_key(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)
    return await rotate_client_key(db, request, username, client_id, "public")


@router.post("/admin/client/{client_id}/rotate-portal-key", include_in_schema=False)
async def rotate_portal_key(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)
    return await rotate_client_key(db, request, username, client_id, "portal")


@router.post("/admin/client/{client_id}/deactivate", include_in_schema=False)
async def deactivate_client(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)

    result = await db.execute(update(Client).where(Client.id == client_id).values(is_active=False).returning(Client.api_key))
    api_key = result.scalar()
    await log_admin_action(db, request, username, "client.deactivated", client_id)
    await db.commit()
    
    if api_key:
        from app.dependencies import clear_client_cache
        clear_client_cache(api_key)
        
    return admin_redirect("ক্লায়েন্ট Deactivate করা হয়েছে")


@router.post("/admin/client/{client_id}/activate", include_in_schema=False)
async def activate_client(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)

    result = await db.execute(update(Client).where(Client.id == client_id).values(is_active=True).returning(Client.api_key))
    api_key = result.scalar()
    await log_admin_action(db, request, username, "client.activated", client_id)
    await db.commit()
    
    if api_key:
        from app.dependencies import clear_client_cache
        clear_client_cache(api_key)
        
    return admin_redirect("ক্লায়েন্ট Activate করা হয়েছে")


# ═══════════════════════════════════════════════════════════════════════════════
# CLIENTS PAGE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/clients", response_class=HTMLResponse, include_in_schema=False)
@limiter.limit("10/minute")
async def admin_clients(
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    msg: str = "",
    msg_type: str = "success",
):
    csrf_token = create_admin_csrf_token(username)
    result = await db.execute(select(Client).order_by(Client.created_at.desc()))
    clients = result.scalars().all()
    active_count = sum(1 for c in clients if c.is_active)
    inactive_count = len(clients) - active_count

    from datetime import datetime, timezone
    from sqlalchemy import func as sql_func, and_
    from app.models.event_log import EventLog
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    client_events_r = await db.execute(
        select(EventLog.client_id, sql_func.coalesce(sql_func.sum(EventLog.event_count), 0))
        .where(and_(EventLog.status == "success", EventLog.created_at >= today))
        .group_by(EventLog.client_id)
    )
    client_events_map = {row[0]: row[1] for row in client_events_r}

    # Stats bar
    stats_html = f"""
    <div class="page-header">
      <div>
        <h1 class="page-title">Client Management</h1>
        <p class="page-sub">Manage all CAPI client integrations.</p>
      </div>
    </div>
    <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 24px;">
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">Total Clients</span><span class="metric-icon">👥</span></div>
        <div class="metric-value">{len(clients)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">Active</span><span class="metric-icon">✅</span></div>
        <div class="metric-value" style="color:#34d399">{active_count}</div>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">Inactive</span><span class="metric-icon">⛔</span></div>
        <div class="metric-value" style="color:#f87171">{inactive_count}</div>
      </div>
    </div>
    """

    # Client cards
    if clients:
        cards = ""
        for c in clients:
            safe_name = html.escape(c.name)
            safe_pixel = html.escape(c.pixel_id)
            safe_key = html.escape(c.api_key, quote=True)
            safe_key_masked = html.escape(mask_secret(c.api_key))
            c_events = client_events_map.get(c.id, 0)
            status_badge = '<span class="badge badge-healthy">Active</span>' if c.is_active else '<span class="badge badge-degraded">Inactive</span>'
            toggle_action = "deactivate" if c.is_active else "activate"
            toggle_label = "Deactivate" if c.is_active else "Activate"
            toggle_class = "btn-danger" if c.is_active else "btn-sm" 
            domain_text = html.escape(c.domain) if c.domain else "<span style=\"color:var(--text-muted)\">—</span>"
            created = c.created_at.strftime("%Y-%m-%d") if c.created_at else "—"
            deferred = "Yes" if getattr(c, 'deferred_purchase', False) else "No"

            cards += f"""
            <div class="card" style="margin-bottom:16px;">
              <div class="card-header">
                <div>
                  <h2 class="card-title" style="margin-bottom:4px">{safe_name}</h2>
                  <span style="font-size:12px;color:var(--text-muted)">Pixel: {safe_pixel} · Created: {created}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">{status_badge}</div>
              </div>
              <div style="padding:20px;">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px;">
                  <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Events (24h)</div><div style="font-size:18px;font-weight:700;color:#34d399">{c_events:,}</div></div>
                  <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Domain</div><div style="font-size:13px;color:#fff">{domain_text}</div></div>
                  <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Deferred Purchase</div><div style="font-size:13px;color:#fff">{deferred}</div></div>
                </div>
                <div style="margin-bottom:16px;">
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">API Key</div>
                  <div class="api-key-cell" style="max-width:100%">
                    <span id="ck_{c.id}" data-secret="{safe_key}" data-masked="{safe_key_masked}" data-hidden="1">{safe_key_masked}</span>
                    <button class="copy-icon" onclick="copyText('ck_{c.id}')" title="Copy">📋</button>
                  </div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:16px">
                  <a href="/api/v1/admin/client/{c.id}/instructions" class="btn-sm btn-info" style="text-decoration:none">📋 Instructions</a>
                  <form method="post" action="/api/v1/admin/client/{c.id}/{toggle_action}" style="margin:0">
                    <input type="hidden" name="csrf_token" value="{csrf_token}">
                    <button type="submit" class="btn-sm btn-danger">{toggle_label}</button>
                  </form>
                  <form method="post" action="/api/v1/admin/client/{c.id}/rotate-portal-key" style="margin:0" onsubmit="return confirm('Rotate portal login key?')">
                    <input type="hidden" name="csrf_token" value="{csrf_token}">
                    <button type="submit" class="btn-sm btn-info">Rotate Portal</button>
                  </form>
                </div>
              </div>
            </div>"""
        client_html = cards
    else:
        client_html = """
        <div class="card">
          <div style="padding:40px 20px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:12px">📭</div>
            <p>No clients found. Add one from the Dashboard.</p>
          </div>
        </div>"""

    body = f"""
    {stats_html}
    {client_html}
    """
    return HTMLResponse(base_html("Clients", body, msg, msg_type, active_page="clients"))


# ═══════════════════════════════════════════════════════════════════════════════
# API LOGS PAGE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/logs", response_class=HTMLResponse, include_in_schema=False)
@limiter.limit("10/minute")
async def admin_logs(
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    from sqlalchemy import func as sql_func, and_
    from app.models.event_log import EventLog
    from app.models.failed_event import FailedEvent

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    success_r = await db.execute(
        select(sql_func.coalesce(sql_func.sum(EventLog.event_count), 0)).where(
            and_(EventLog.status == "success", EventLog.created_at >= today)
        )
    )
    events_today = success_r.scalar() or 0

    fail_r = await db.execute(
        select(sql_func.coalesce(sql_func.sum(EventLog.event_count), 0)).where(
            and_(EventLog.status == "failed", EventLog.created_at >= today)
        )
    )
    failed_today = fail_r.scalar() or 0

    retry_r = await db.execute(
        select(sql_func.count(FailedEvent.id)).where(
            FailedEvent.status.in_(["pending", "retrying"])
        )
    )
    retries = retry_r.scalar() or 0

    total = events_today + failed_today

    # Recent event logs (last 100)
    from sqlalchemy.orm import selectinload
    logs_r = await db.execute(
        select(EventLog).order_by(EventLog.created_at.desc()).limit(100)
    )
    event_logs = logs_r.scalars().all()

    # Client name map
    clients_r = await db.execute(select(Client.id, Client.name))
    client_map = {row[0]: row[1] for row in clients_r}

    # Failed events (last 50)
    failed_r = await db.execute(
        select(FailedEvent).order_by(FailedEvent.created_at.desc()).limit(50)
    )
    failed_events = failed_r.scalars().all()

    # Stats
    header_html = f"""
    <div class="page-header">
      <div>
        <h1 class="page-title">API Event Logs</h1>
        <p class="page-sub">Real-time event processing history and error tracking.</p>
      </div>
    </div>
    <div class="metrics-grid" style="margin-bottom:24px">
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">Success (24h)</span><span class="metric-icon">✅</span></div>
        <div class="metric-value" style="color:#34d399">{events_today:,}</div>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">Failed (24h)</span><span class="metric-icon">❌</span></div>
        <div class="metric-value" style="color:#f87171">{failed_today:,}</div>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">Total (24h)</span><span class="metric-icon">📊</span></div>
        <div class="metric-value">{total:,}</div>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">Pending Retries</span><span class="metric-icon">🔄</span></div>
        <div class="metric-value" style="color:#facc15">{retries}</div>
      </div>
    </div>
    """

    # Event log table
    if event_logs:
        rows = ""
        for log in event_logs:
            c_name = html.escape(client_map.get(log.client_id, f"#{log.client_id}"))
            e_name = html.escape(log.event_name or "—")
            e_count = log.event_count or 1
            status_cls = "badge-healthy" if log.status == "success" else "badge-degraded"
            status_text = log.status or "unknown"
            ip = html.escape(log.ip_address or "—")
            emq = f"{log.emq_score:.1f}" if log.emq_score else "—"
            created = log.created_at.strftime("%H:%M:%S") if log.created_at else "—"
            rows += f"""
            <tr>
              <td class="code-text">{created}</td>
              <td>{c_name}</td>
              <td><span style="color:#818cf8;font-weight:600">{e_name}</span></td>
              <td class="code-text" style="text-align:center">{e_count}</td>
              <td><span class="badge {status_cls}">{status_text}</span></td>
              <td class="code-text">{ip}</td>
              <td class="code-text">{emq}</td>
            </tr>"""
        event_table = f"""
        <div class="card" style="margin-bottom:24px">
          <div class="card-header"><h2 class="card-title">📡 Recent Events (Last 100)</h2></div>
          <div class="table-responsive">
            <table>
              <thead><tr>
                <th>Time</th><th>Client</th><th>Event</th><th style="text-align:center">Count</th><th>Status</th><th>IP</th><th>EMQ</th>
              </tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        </div>"""
    else:
        event_table = """
        <div class="card" style="margin-bottom:24px">
          <div class="card-header"><h2 class="card-title">📡 Recent Events</h2></div>
          <div style="padding:30px;text-align:center;color:var(--text-muted)">No event logs recorded yet.</div>
        </div>"""

    # Failed events table
    if failed_events:
        fail_rows = ""
        for fe in failed_events:
            c_name = html.escape(client_map.get(fe.client_id, f"#{fe.client_id}"))
            err = html.escape((fe.error_message or "—")[:80])
            retries_c = fe.retry_count or 0
            max_r = fe.max_retries or 5
            st = fe.status or "pending"
            st_color = "#facc15" if st == "pending" else ("#818cf8" if st == "retrying" else "#f87171")
            created = fe.created_at.strftime("%Y-%m-%d %H:%M") if fe.created_at else "—"
            fail_rows += f"""
            <tr>
              <td class="code-text">{created}</td>
              <td>{c_name}</td>
              <td style="color:var(--text-muted);font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis">{err}</td>
              <td class="code-text" style="text-align:center">{retries_c}/{max_r}</td>
              <td><span style="color:{st_color};font-weight:600;font-size:12px">{st.upper()}</span></td>
            </tr>"""
        failed_table = f"""
        <div class="card">
          <div class="card-header"><h2 class="card-title">⚠️ Failed Events (Last 50)</h2></div>
          <div class="table-responsive">
            <table>
              <thead><tr>
                <th>Time</th><th>Client</th><th>Error</th><th style="text-align:center">Retries</th><th>Status</th>
              </tr></thead>
              <tbody>{fail_rows}</tbody>
            </table>
          </div>
        </div>"""
    else:
        failed_table = """
        <div class="card">
          <div class="card-header"><h2 class="card-title">⚠️ Failed Events</h2></div>
          <div style="padding:30px;text-align:center;color:var(--text-muted)">No failed events. Everything is running smoothly! 🎉</div>
        </div>"""

    body = f"""
    {header_html}
    {event_table}
    {failed_table}
    """
    return HTMLResponse(base_html("API Logs", body, active_page="logs"))


# ═══════════════════════════════════════════════════════════════════════════════
# SETTINGS PAGE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/settings", response_class=HTMLResponse, include_in_schema=False)
@limiter.limit("10/minute")
async def admin_settings(
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    import sys

    # Environment checks
    env_checks = {
        "ADMIN_PASSWORD": bool(os.getenv("ADMIN_PASSWORD")),
        "ENCRYPTION_KEY": bool(os.getenv("ENCRYPTION_KEY")),
        "ADMIN_API_KEY": bool(os.getenv("ADMIN_API_KEY")),
        "DATABASE_URL": bool(os.getenv("DATABASE_URL")),
    }

    env_rows = ""
    for key, configured in env_checks.items():
        badge = '<span class="badge badge-healthy">Configured</span>' if configured else '<span class="badge badge-degraded">Missing</span>'
        env_rows += f"""
        <tr>
          <td style="font-weight:600">{key}</td>
          <td>{badge}</td>
        </tr>"""

    # System info
    python_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    admin_user = html.escape(ADMIN_USERNAME)

    # Audit logs (last 50)
    audit_r = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(50))
    audit_logs = audit_r.scalars().all()

    if audit_logs:
        audit_rows = ""
        for log in audit_logs:
            safe_actor = html.escape(log.actor or "system")
            safe_action = html.escape(log.action or "—")
            safe_details = html.escape((log.details or "—")[:60])
            safe_ip = html.escape(log.ip_address or "—")
            created = log.created_at.strftime("%Y-%m-%d %H:%M") if log.created_at else "—"
            audit_rows += f"""
            <tr>
              <td class="code-text">{created}</td>
              <td>{safe_actor}</td>
              <td><span style="color:#818cf8">{safe_action}</span></td>
              <td class="code-text">{log.client_id or '—'}</td>
              <td class="code-text">{safe_ip}</td>
              <td style="color:var(--text-muted);font-size:12px">{safe_details}</td>
            </tr>"""
        audit_table = f"""
        <div class="card">
          <div class="card-header"><h2 class="card-title">📋 Full Audit Log (Last 50)</h2></div>
          <div class="table-responsive">
            <table>
              <thead><tr>
                <th>Time</th><th>Actor</th><th>Action</th><th>Client</th><th>IP</th><th>Details</th>
              </tr></thead>
              <tbody>{audit_rows}</tbody>
            </table>
          </div>
        </div>"""
    else:
        audit_table = """
        <div class="card">
          <div class="card-header"><h2 class="card-title">📋 Audit Log</h2></div>
          <div style="padding:30px;text-align:center;color:var(--text-muted)">No audit entries yet.</div>
        </div>"""

    body = f"""
    <div class="page-header">
      <div>
        <h1 class="page-title">System Settings</h1>
        <p class="page-sub">Server configuration, environment status, and admin activity.</p>
      </div>
    </div>

    <div class="layout-grid" style="margin-bottom:24px">
      <div class="card">
        <div class="card-header"><h2 class="card-title">🖥️ System Information</h2></div>
        <div style="padding:20px">
          <table style="width:100%">
            <tr><td style="color:var(--text-muted);padding:8px 0;font-size:13px;width:40%">Python Version</td><td style="padding:8px 0;font-weight:600">{python_ver}</td></tr>
            <tr><td style="color:var(--text-muted);padding:8px 0;font-size:13px">Admin Username</td><td style="padding:8px 0;font-weight:600">{admin_user}</td></tr>
            <tr><td style="color:var(--text-muted);padding:8px 0;font-size:13px">Environment</td><td style="padding:8px 0"><span class="env-badge">PRODUCTION</span></td></tr>
            <tr><td style="color:var(--text-muted);padding:8px 0;font-size:13px">Default Rate Limit</td><td style="padding:8px 0;font-weight:600">5,000 req/min</td></tr>
            <tr><td style="color:var(--text-muted);padding:8px 0;font-size:13px">Default Daily Quota</td><td style="padding:8px 0;font-weight:600">100,000 events</td></tr>
            <tr><td style="color:var(--text-muted);padding:8px 0;font-size:13px">Default Monthly Limit</td><td style="padding:8px 0;font-weight:600">50,000 events</td></tr>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h2 class="card-title">🔐 Environment Variables</h2></div>
        <div class="table-responsive">
          <table>
            <thead><tr><th>Variable</th><th>Status</th></tr></thead>
            <tbody>{env_rows}</tbody>
          </table>
        </div>
      </div>
    </div>

    {audit_table}
    """
    return HTMLResponse(base_html("Settings", body, active_page="settings"))
