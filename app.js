/**
 * ASISTEN-ANE - Complete Application
 * 
 * Features:
 * - Quick Chat History (saved to DB)
 * - Copy Button on every message (user + AI)
 * - Copy Button on code blocks
 * - Math formulas (left-aligned)
 */

// =====================================================
// CONFIGURATION
// =====================================================
const SUPABASE_URL = 'https://gazznzjhnsislhbdofde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhenpuempobnNpc2xoYmRvZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzgwNjQsImV4cCI6MjA5MTY1NDA2NH0.mNPSA2p0wl1p9IezUbbzWKu0x2TnHGNiSbxscfghZfg';

// Special project ID for quick chat history
const QUICK_CHAT_PROJECT_ID = 'quick-chat-default';

// =====================================================
// STATE
// =====================================================
let supabaseClient = null;
let currentUser = null;
let currentProject = null;
let currentSession = null;
let currentUIMode = 'quick';
let isLoading = false;
let projects = [];
let currentRawContent = {}; // Store raw text for copying

// Performance throttle
const UPDATE_THROTTLE_MS = 50;

// =====================================================
// UTILITIES
// =====================================================
function showToast(msg, type = 'info', dur = 3000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), dur);
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function hideLoading() {
    const o = document.getElementById('loadingOverlay');
    o.classList.add('hidden');
    setTimeout(() => o.style.display = 'none', 350);
}

function showLoading(text = 'Memuat...') {
    const o = document.getElementById('loadingOverlay');
    o.querySelector('.loading-text').textContent = text;
    o.style.display = 'flex';
    o.classList.remove('hidden');
}

function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function generateId() {
    return crypto.randomUUID();
}

// =====================================================
// SUPABASE INIT
// =====================================================
async function initSupabase() {
    try {
        console.log('[Init] Connecting...');
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
                storage: window.localStorage,
                flowType: 'pkce'
            }
        });
        console.log('[Init] Connected');
        return true;
    } catch (e) {
        console.error('[Init] Error:', e);
        showToast('Gagal terhubung ke server', 'error');
        return false;
    }
}

// =====================================================
// AUTHENTICATION
// =====================================================
async function signInWithGoogle() {
    if (!supabaseClient) return;
    
    const btn = document.querySelector('.login-btn-google');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div style="width:14px;height:14px;border:2px solid #dadce0;border-top-color:#d97706;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;"></div>';
    }

    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: { access_type: 'offline', prompt: 'consent' }
            }
        });
        if (error) throw error;
    } catch (e) {
        showToast('Login gagal: ' + e.message, 'error');
        if (btn) { btn.disabled = false; renderLoginButton(); }
    }
}

async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.reload();
}

// =====================================================
// CHECK AUTH
// =====================================================
async function checkAuth() {
    try {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            showLoading('Menyelesaikan login...');
            await new Promise(r => setTimeout(r, 1200));
            window.history.replaceState(null, '', window.location.pathname);
        }

        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        const authEl = document.getElementById('authSection');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        if (session?.user) {
            currentUser = session.user;
            const meta = session.user.user_metadata || {};
            const name = meta.full_name || meta.name || currentUser.email.split('@')[0];
            const pic = meta.avatar_url || meta.picture;

            // User profile - Nama + Email only
            authEl.innerHTML = `
                <div class="user-profile">
                    <div class="user-avatar">${pic ? `<img src="${pic}" alt="" referrerpolicy="no-referrer">` : name[0].toUpperCase()}</div>
                    <div class="user-details">
                        <div class="user-name">${escapeHtml(name)}</div>
                        <div class="user-email-display">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            ${currentUser.email}
                        </div>
                    </div>
                </div>
                <button class="logout-btn" onclick="signOut()">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Keluar
                </button>
            `;

            statusDot.className = 'status-dot online';
            statusText.textContent = 'Online';

            document.getElementById('chatModeSection').style.display = 'flex';
            document.getElementById('deleteAllBtn').style.display = 'flex';
            document.getElementById('inputArea').style.display = 'block';

            applyUIMode(currentUIMode);

        } else {
            currentUser = null;
            renderLoginButton();
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Belum login';
            document.getElementById('chatModeSection').style.display = 'none';
            document.getElementById('deleteAllBtn').style.display = 'none';
            document.getElementById('quickChatHistory').style.display = 'none';
            document.getElementById('projectsList').style.display = 'none';
            updateWelcome(false);
        }
    } catch (e) {
        console.error('[Auth]', e);
        showToast('Error autentikasi', 'error');
    }
}

function renderLoginButton() {
    document.getElementById('authSection').innerHTML = `
        <button class="login-btn-google" onclick="signInWithGoogle()">
            <svg class="google-icon" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Masuk Google
        </button>
        <p class="login-hint">Login untuk mulai chat</p>
    `;
}

// =====================================================
// UI MODE SWITCHING
// =====================================================
function setChatMode(mode) {
    currentUIMode = mode;
    applyUIMode(mode);
}

function applyUIMode(mode) {
    const qBtn = document.getElementById('quickChatModeBtn');
    const pBtn = document.getElementById('projectModeBtn');
    const nChat = document.getElementById('newChatBtn');
    const nProj = document.getElementById('newProjectBtn');
    const qHistory = document.getElementById('quickChatHistory');
    const pList = document.getElementById('projectsList');
    const badge = document.getElementById('modeBadge');

    if (mode === 'quick') {
        qBtn.classList.add('active'); pBtn.classList.remove('active');
        nChat.style.display = 'flex'; nProj.style.display = 'none';
        qHistory.style.display = 'block'; pList.style.display = 'none';
        badge.className = 'mode-badge quick'; badge.textContent = 'Quick Chat';
        currentProject = null;
        document.getElementById('currentChatTitle').textContent = 'Asisten-Ane - Quick Chat';
        
        // Load quick chat history
        loadQuickChatHistory();
        
        if (!currentSession) updateWelcome(true, 'quick');
    } else {
        qBtn.classList.remove('active'); pBtn.classList.add('active');
        nChat.style.display = 'none'; nProj.style.display = 'flex';
        qHistory.style.display = 'none'; pList.style.display = 'block';
        badge.className = 'mode-badge project'; badge.textContent = 'Project Mode';
        loadProjects();
        if (!currentProject) updateWelcome(true, 'project');
    }
}

function startNewQuickChat() {
    if (!currentUser) { showToast('Login dulu!', 'warning'); return; }
    currentProject = null;
    currentSession = generateId();
    currentRawContent = {};
    document.getElementById('messagesContainer').innerHTML = '';
    addMessageToUI('assistant', 'Halo! Aku Asisten-Ane. Ada yang bisa aku bantu? 😊\n\nMode: *Quick Chat*\n\n💡 Riwayat chat akan otomatis tersimpan.');
}

// =====================================================
// QUICK CHAT HISTORY - SAVE & LOAD
// =====================================================

/**
 * Ensure quick chat "project" exists in database
 */
async function ensureQuickChatProject() {
    if (!currentUser) return null;
    
    try {
        // Check if exists
        const { data } = await supabaseClient
            .from('projects')
            .select('id')
            .eq('id', QUICK_CHAT_PROJECT_ID)
            .eq('user_id', currentUser.id)
            .single();
            
        if (data) return data.id;
        
        // Create it
        const { data: newProj, error } = await supabaseClient
            .from('projects')
            .insert({ 
                id: QUICK_CHAT_PROJECT_ID, 
                name: '⚡ Quick Chat History', 
                user_id: currentUser.id 
            })
            .select('id')
            .single();
            
        if (error) throw error;
        return newProj.id;
    } catch (e) {
        console.error('[QuickChat] Ensure project error:', e);
        return QUICK_CHAT_PROJECT_ID;
    }
}

/**
 * Load quick chat sessions list
 */
async function loadQuickChatHistory() {
    if (!currentUser) return;
    
    try {
        const projectId = await ensureQuickChatProject();
        
        const { data } = await supabaseClient
            .from('chat_history')
            .select('session_id, role, content, created_at')
            .eq('project_id', projectId)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        // Group by session
        const sessions = {};
        (data || []).forEach(m => {
            if (!sessions[m.session_id]) {
                sessions[m.session_id] = {
                    id: m.session_id,
                    last: m.content.substring(0, 40),
                    time: m.created_at,
                    count: 0
                };
            }
            sessions[m.session_id].count++;
        });
        
        renderQuickChatList(Object.values(sessions));
    } catch (e) {
        console.error('[QuickChat] Load error:', e);
    }
}

/**
 * Render quick chat history in sidebar
 */
function renderQuickChatList(sessions) {
    const container = document.getElementById('quickChatHistory');
    container.innerHTML = '<div class="section-divider">Riwayat Chat</div>';
    
    if (!sessions.length) {
        container.innerHTML += `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <p>Belum ada riwayat.<br>Mulai chat baru!</p>
            </div>`;
        return;
    }
    
    // Sort by time descending
    sessions.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    // Show last 20 sessions
    sessions.slice(0, 20).forEach(s => {
        const div = document.createElement('div');
        div.className = 'session-item';
        div.onclick = () => loadQuickChatSession(s.id);
        div.innerHTML = `
            <span class="session-preview">💬 ${escapeHtml(s.last)}...</span>
            <button class="delete-session" onclick="event.stopPropagation(); deleteQuickChatSession('${s.id}')">✕</button>
        `;
        container.appendChild(div);
    });
}

/**
 * Load a specific quick chat session
 */
async function loadQuickChatSession(sessionId) {
    if (!currentUser) return;
    
    try {
        const projectId = await ensureQuickChatProject();
        
        const { data } = await supabaseClient
            .from('chat_history')
            .select('role, content')
            .eq('project_id', projectId)
            .eq('session_id', sessionId)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: true });
        
        currentSession = sessionId;
        currentRawContent = {};
        document.getElementById('currentChatTitle').textContent = '⚡ Quick Chat - Riwayat';
        
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        
        (data || []).forEach(m => {
            addMessageToUI(m.role, m.content, m.role === 'user' ? 'msg-user-' + Date.now() : 'msg-ai-' + Date.now());
        });
        
        showToast('Riwayat dimuat', 'success', 1500);
    } catch (e) {
        showToast('Gagal memuat riwayat', 'error');
    }
}

/**
 * Delete a quick chat session
 */
async function deleteQuickChatSession(sessionId) {
    if (!confirm('Hapus riwayat chat ini?')) return;
    
    try {
        const projectId = await ensureQuickChatProject();
        
        await supabaseClient.from('chat_history')
            .delete()
            .eq('project_id', projectId)
            .eq('session_id', sessionId)
            .eq('user_id', currentUser.id);
        
        loadQuickChatHistory();
        
        if (currentSession === sessionId) {
            startNewQuickChat();
        }
        
        showToast('Riwayat dihapus', 'success');
    } catch (e) {
        showToast('Gagal menghapus', 'error');
    }
}

/**
 * Save message to database (for both quick and project mode)
 */
async function saveMessageToDB(role, content) {
    if (!currentUser || !currentSession) return;
    
    try {
        let projectId = currentProject ? currentProject.id : null;
        
        // If quick chat mode, use default project
        if (currentUIMode === 'quick' && !projectId) {
            projectId = await ensureQuickChatProject();
        }
        
        await supabaseClient.from('chat_history').insert({
            role: role,
            content: content,
            session_id: currentSession,
            project_id: projectId,
            user_id: currentUser.id
        });
    } catch (e) {
        console.error('[DB] Save error:', e);
        // Don't show toast for save errors to not interrupt UX
    }
}

// =====================================================
// PROJECT MODE FUNCTIONS
// =====================================================
async function loadProjects() {
    if (!currentUser) return [];
    try {
        const { data, error } = await supabaseClient.from('projects')
            .select('*').eq('user_id', currentUser.id)
            .neq('id', QUICK_CHAT_PROJECT_ID) // Exclude quick chat project
            .order('created_at', { ascending: false });
        if (error) throw error;
        projects = data || [];
        renderProjects();
        return projects;
    } catch (e) { console.error('[DB]', e); return []; }
}

async function loadSessions(pid) {
    if (!currentUser) return [];
    try {
        const { data } = await supabaseClient.from('chat_history')
            .select('session_id, role, content, created_at')
            .eq('project_id', pid).eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        const sessions = {};
        (data || []).forEach(m => {
            if (!sessions[m.session_id]) sessions[m.session_id] = { id: m.session_id, last: m.content.substring(0, 40), time: m.created_at };
        });
        return Object.values(sessions);
    } catch (e) { return []; }
}

async function loadHistory(pid, sid) {
    if (!currentUser) return [];
    try {
        const { data } = await supabaseClient.from('chat_history')
            .select('role, content').eq('project_id', pid).eq('session_id', sid)
            .eq('user_id', currentUser.id).order('created_at', { ascending: true });
        return data || [];
    } catch (e) { return []; }
}

function renderProjects() {
    const c = document.getElementById('projectsList');
    c.innerHTML = '<div class="section-divider">Projects</div>';
    if (!projects.length) {
        c.innerHTML += `<div class="empty-state"><div class="empty-state-icon">📁</div><p>Belum ada project.</p></div>`;
        return;
    }
    projects.forEach(p => {
        const div = document.createElement('div');
        div.className = 'project-item';
        div.innerHTML = `
            <div class="project-header" onclick="toggleSessions('${p.id}')" ondblclick="selectProjectDirect(${JSON.stringify(p).replace(/"/g,'&quot;')})">
                <span class="project-name"><span class="folder-icon">📁</span>${escapeHtml(p.name)}</span>
                <div class="project-actions">
                    <button onclick="event.stopPropagation();deleteProject('${p.id}')" title="Hapus">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
            <div class="sessions-list" id="sess-${p.id}"></div>`;
        c.appendChild(div);
        loadSessions(p.id).then(sessions => {
            const sc = document.getElementById(`sess-${p.id}`);
            if (sc && sessions.length) {
                sessions.forEach(s => {
                    const sd = document.createElement('div');
                    sd.className = 'session-item';
                    sd.onclick = () => selectProject(p, s.id);
                    sd.innerHTML = `<span class="session-preview">💬 ${escapeHtml(s.last)}</span><button class="delete-session" onclick="event.stopPropagation();deleteSession('${p.id}','${s.id}')">✕</button>`;
                    sc.appendChild(sd);
                });
            }
        });
    });
}

function toggleSessions(id) {
    const el = document.getElementById('sess-' + id);
    if (el) el.classList.toggle('open');
}

function selectProjectDirect(p) { selectProject(p); }

async function selectProject(project) {
    currentProject = project;
    currentSession = null;
    currentRawContent = {};
    document.getElementById('currentChatTitle').innerHTML = `📁 ${escapeHtml(project.name)}`;
    document.getElementById('messagesContainer').innerHTML = '';
    const sessions = await loadSessions(project.id);
    if (sessions.length) {
        const div = document.createElement('div');
        div.className = 'sessions-container';
        div.innerHTML = '<h3>Percakapan:</h3>';
        sessions.forEach(s => {
            const b = document.createElement('button');
            b.className = 'session-history-btn';
            b.textContent = s.last + '...';
            b.onclick = () => selectSession(project, s.id);
            div.appendChild(b);
        });
        const nb = document.createElement('button');
        nb.className = 'new-chat-session-btn';
        nb.textContent = '+ Chat baru';
        nb.onclick = () => { currentSession = generateId(); currentRawContent = {}; document.getElementById('messagesContainer').innerHTML = ''; addMessageToUI('assistant', `Project: **${project.name}**\n\nHalo!`); };
        div.appendChild(nb);
        document.getElementById('messagesContainer').appendChild(div);
    } else {
        addMessageToUI('assistant', `Project: **${project.name}**\n\nMulai percakapan baru.`);
    }
}

async function selectSession(p, sid) {
    currentProject = p;
    currentSession = sid;
    currentRawContent = {};
    document.getElementById('currentChatTitle').innerHTML = `💬 ${escapeHtml(p.name)}`;
    const hist = await loadHistory(p.id, sid);
    const c = document.getElementById('messagesContainer');
    c.innerHTML = '';
    hist.forEach((m, i) => addMessageToUI(m.role, m.content, `${m.role}-${i}`));
}

// CRUD Operations
async function createProject() {
    const name = document.getElementById('projectNameInput').value.trim();
    if (!name) { showToast('Masukkan nama', 'warning'); return; }
    try {
        const { data, error } = await supabaseClient.from('projects').insert({ name, user_id: currentUser.id }).select().single();
        if (error) throw error;
        closeModal(); await loadProjects(); selectProject(data);
        showToast('Project dibuat!', 'success');
    } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

async function deleteProject(id) {
    if (!confirm('Hapus project?')) return;
    await supabaseClient.from('chat_history').delete().eq('project_id', id).eq('user_id', currentUser.id);
    await supabaseClient.from('projects').delete().eq('id', id).eq('user_id', currentUser.id);
    await loadProjects();
    if (currentProject?.id === id) { currentProject = null; updateWelcome(true, 'project'); }
}

async function deleteSession(pid, sid) {
    if (!confirm('Hapus chat?')) return;
    await supabaseClient.from('chat_history').delete().eq('project_id', pid).eq('session_id', sid).eq('user_id', currentUser.id);
    await loadProjects();
    if (currentSession === sid) { currentSession = null; if (currentProject) selectProject(currentProject); }
}

async function clearCurrentChat() {
    if (!confirm('Hapus percakapan ini?')) return;
    if (!currentSession) return;
    
    try {
        let projectId = currentProject ? currentProject.id : QUICK_CHAT_PROJECT_ID;
        if (currentUIMode === 'quick') projectId = await ensureQuickChatProject();
        
        await supabaseClient.from('chat_history')
            .delete()
            .eq('project_id', projectId)
            .eq('session_id', currentSession)
            .eq('user_id', currentUser.id);
        
        if (currentUIMode === 'quick') {
            startNewQuickChat();
            loadQuickChatHistory();
        } else if (currentProject) {
            selectProject(currentProject);
        }
        
        showToast('Chat dihapus', 'success');
    } catch (e) {
        showToast('Gagal menghapus', 'error');
    }
}

async function deleteAll() {
    if (!confirm('HAPUS SEMUA DATA?')) return;
    await supabaseClient.from('chat_history').delete().eq('user_id', currentUser.id);
    await supabaseClient.from('projects').delete().eq('user_id', currentUser.id);
    await loadProjects();
    currentProject = null; currentSession = null; currentRawContent = {};
    updateWelcome(true, currentUIMode);
}

// =====================================================
// MESSAGE FORMATTING
// =====================================================
function formatMessage(content) {
    let formatted = escapeHtml(content);

    // Code blocks
    // Di dalam formatMessage(), cari bagian code block:
formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'plaintext';
    const cleanCode = code.trim();
    const bid = 'cb-' + generateId().substr(0, 8);
    
    return `
        <div class="code-block-wrapper" id="${bid}" style="max-width:100%;overflow:hidden;">
            <div class="code-block-header">
                <span class="code-language">${language}</span>
                <button class="code-copy-btn" onclick="copyCode('${bid}',this)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    Copy
                </button>
            </div>
            <pre style="max-width:100%;overflow-x:auto;"><code class="language-${language}">${cleanCode}</code></pre>
        </div>
    `;
});

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Math - Display (left aligned)
    formatted = formatted.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        return `<div class="math-formula">$$${formula}$$</div>`;
    });

    // Math - Inline
    formatted = formatted.replace(/\$([^$]+)\$/g, (match, formula) => {
        return `<span class="math-inline">$${formula}$</span>`;
    });

    // Bold / Italic
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

// =====================================================
// COPY FUNCTIONS
// =====================================================

/**
 * Copy code from code block
 */
async function copyCode(blockId, btn) {
    const wrapper = document.getElementById(blockId);
    const code = wrapper.querySelector('code').textContent;
    
    try {
        await navigator.clipboard.writeText(code);
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> OK!';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy';
        }, 1500);
        showToast('Code disalin!', 'success', 1500);
    } catch (e) {
        showToast('Copy gagal', 'error');
    }
}

/**
 * Copy entire message content (raw text)
 */
async function copyMessage(messageId, btn) {
    const rawText = currentRawContent[messageId] || '';
    
    if (!rawText) {
        showToast('Tidak ada teks', 'warning');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(rawText);
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copy`;
        }, 1500);
        
        showToast('Pesan disalin!', 'success', 1500);
    } catch (e) {
        showToast('Copy gagal', 'error');
    }
}

// Render MathJax & Prism (debounced)
const renderFormattedContent = debounce(() => {
    if (typeof Prism !== 'undefined') {
        Prism.highlightAllUnder(document.getElementById('messagesContainer'), false);
    }
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
        const container = document.getElementById('messagesContainer');
        if (container) MathJax.typesetPromise([container]).catch(err => {});
    }
}, UPDATE_THROTTLE_MS);

// =====================================================
// MESSAGE UI - WITH COPY BUTTON
// =====================================================
function addMessageToUI(role, content, messageId = null) {
    const container = document.getElementById('messagesContainer');
    const welcome = container.querySelector('#welcomeScreen');
    if (welcome) welcome.style.display = 'none';

    // Generate unique ID for this message
    const msgId = messageId || `${role}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // Store raw content for copying
    currentRawContent[msgId] = content;

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;
    wrapper.innerHTML = `
        <button class="msg-copy-btn" onclick="copyMessage('${msgId}', this)" title="Salin pesan">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copy
        </button>
        <div class="message ${role}">
            <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
            <div class="message-content">${formatMessage(content)}</div>
        </div>`;

    container.appendChild(wrapper);
    
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
        renderFormattedContent();
    });

    return wrapper;
}

function addLoadingIndicator() {
    const container = document.getElementById('messagesContainer');
    const welcome = container.querySelector('#welcomeScreen');
    if (welcome) welcome.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper assistant';
    wrapper.id = 'loading-msg';
    wrapper.innerHTML = `
        <div class="message assistant">
            <div class="message-avatar">🤖</div>
            <div class="message-content"><div class="loading-dots"><span></span><span></span><span></span></div></div>
        </div>`;
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function removeLoadingIndicator() {
    const el = document.getElementById('loading-msg');
    if (el) el.remove();
}

// =====================================================
// SEND MESSAGE
// =====================================================
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const msg = input.value.trim();
    if (!msg || isLoading) return;
    if (!currentUser) { showToast('Login dulu!', 'warning'); return; }

    input.value = '';
    input.style.height = 'auto';
    isLoading = true;
    document.getElementById('sendBtn').disabled = true;

    // Add user message with unique ID
    const userMsgId = `user-${Date.now()}`;
    addMessageToUI('user', msg, userMsgId);
    
    // Save user message to DB
    saveMessageToDB('user', msg);

    if (!currentSession) currentSession = generateId();
    addLoadingIndicator();

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Session expired. Login ulang.');

        const payload = {
            message: msg,
            session_id: currentSession,
            stream: true
        };

        if (currentUIMode !== 'quick' && currentProject) {
            payload.project_id = currentProject.id;
        }
        if (currentUIMode === 'quick') payload.guest_mode = true;

        const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-ane`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Error ${res.status}: ${errText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let aiResp = '';
        let aiEl = null;
        const aiMsgId = `ai-${Date.now()}`;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            decoder.decode(value, { stream: true }).split('\n').forEach(line => {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') return;
                    
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        
                        if (content) {
                            aiResp += content;

                            if (!aiEl) {
                                removeLoadingIndicator();
                                aiEl = addMessageToUI('assistant', aiResp, aiMsgId);
                            } else if (aiResp.length % 80 < content.length) {
                                const contentDiv = aiEl.querySelector('.message-content');
                                if (contentDiv) {
                                    contentDiv.innerHTML = formatMessage(aiResp);
                                    // Update stored raw content
                                    currentRawContent[aiMsgId] = aiResp;
                                }
                                const container = document.getElementById('messagesContainer');
                                container.scrollTop = container.scrollHeight;
                            }
                        }
                    } catch (e) {}
                }
            });
        }

        // Final update
        if (aiEl) {
            const contentDiv = aiEl.querySelector('.message-content');
            if (contentDiv) {
                contentDiv.innerHTML = formatMessage(aiResp);
            }
            currentRawContent[aiMsgId] = aiResp;
            renderFormattedContent();
        }
        
        // Save AI response to DB
        if (aiResp) {
            saveMessageToDB('assistant', aiResp);
        }

        // Refresh sidebar lists
        if (currentUIMode === 'quick') {
            loadQuickChatHistory();
        } else if (currentProject) {
            await loadProjects();
        }

    } catch (e) {
        console.error('[Chat]', e);
        removeLoadingIndicator();
        const errMsgId = `error-${Date.now()}`;
        addMessageToUI('assistant', 'Error: ' + e.message, errMsgId);
    } finally {
        isLoading = false;
        document.getElementById('sendBtn').disabled = false;
        input.focus();
    }
}

function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

// =====================================================
// WELCOME SCREEN
// =====================================================
function updateWelcome(loggedIn, mode = 'quick') {
    const c = document.getElementById('messagesContainer');
    
    if (!loggedIn) {
        c.innerHTML = `
            <div class="welcome-screen" id="welcomeScreen">
                <div class="welcome-icon">🤖</div>
                <h2>Selamat Datang!</h2>
                <p>Login dengan Google untuk mulai.</p>
                <div class="example-prompts">
                    <div class="example-prompt" onclick="setExamplePrompt('Hello')"><span>👋</span> Sapa</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Siapa kamu?')"><span>🤖</span> Tentang</div>
                </div>
            </div>`;
    } else if (mode === 'quick') {
        c.innerHTML = `
            <div class="welcome-screen" id="welcomeScreen">
                <div class="welcome-icon">⚡</div>
                <h2>Quick Chat</h2>
                <p>Chat cepat dengan riwayat tersimpan.</p>
                <div class="example-prompts">
                    <div class="example-prompt" onclick="setExamplePrompt('Buatkan HTML')"><span>💻</span> HTML</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Jelaskan rumus fisika')"><span>🔬</span> Fisika</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Tips coding')"><span>💡</span> Tips</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Hitung ∫x²dx')"><span>🔢</span> Matematika</div>
                </div>
            </div>`;
    } else {
        c.innerHTML = `
            <div class="welcome-screen" id="welcomeScreen">
                <div class="welcome-icon">📁</div>
                <h2>Project Mode</h2>
                <p>Pilih project dari sidebar.</p>
                <div class="example-prompts">
                    <div class="example-prompt" onclick="setExamplePrompt('Buat API REST')"><span>🔧</span> API</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Database schema')"><span>🗄️</span> DB</div>
                </div>
            </div>`;
    }
}

function setExamplePrompt(prompt) {
    if (!currentUser) { showToast('Login dulu!', 'warning'); return; }
    document.getElementById('messageInput').value = prompt;
    sendMessage();
}

// =====================================================
// MODAL & THEME
// =====================================================
function showNewProjectModal() {
    document.getElementById('newProjectModal').classList.add('show');
    document.getElementById('projectNameInput').value = '';
    setTimeout(() => document.getElementById('projectNameInput').focus(), 80);
}
function closeModal() { document.getElementById('newProjectModal').classList.remove('show'); }

function toggleTheme() {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    icon.innerHTML = document.body.classList.contains('dark')
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}

// Event Listeners
document.getElementById('newProjectModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

const textarea = document.getElementById('messageInput');
textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});
textarea.addEventListener('keydown', handleKeydown);

// =====================================================
// INIT
// =====================================================
async function init() {
    console.log('[Init] Starting...');
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
    
    const ok = await initSupabase();
    if (!ok) { hideLoading(); renderLoginButton(); return; }

    await checkAuth();

    supabaseClient.auth.onAuthStateChange((event) => {
        console.log('[Auth]', event);
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            setTimeout(() => window.location.reload(), 700);
        }
    });

    hideLoading();
    console.log('[Init] Ready!');
}

init();