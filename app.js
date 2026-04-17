/**
 * ASISTEN-ANE - Main Application JavaScript
 * Features:
 * - Syntax Highlighting (Prism.js)
 * - Code Copy Button
 * - MathJax Support (Matematika/Fisika/Biologi)
 * - Supabase Auth & Database
 */

// =====================================================
// KONFIGURASI SUPABASE
// =====================================================
const SUPABASE_URL = 'https://gazznzjhnsislhbdofde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhenpuempobnNpc2xoYmRvZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzgwNjQsImV4cCI6MjA5MTY1NDA2NH0.mNPSA2p0wl1p9IezUbbzWKu0x2TnHGNiSbxscfghZfg';

// =====================================================
// STATE MANAGEMENT
// =====================================================
let supabaseClient = null;
let currentUser = null;
let currentProject = null;
let currentSession = null;
let currentUIMode = 'quick'; // 'quick' or 'project'
let isLoading = false;
let projects = [];

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 3500) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), duration);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => overlay.style.display = 'none', 400);
}

/**
 * Show loading overlay
 */
function showLoading(text = 'Memuat...') {
    const overlay = document.getElementById('loadingOverlay');
    overlay.querySelector('.loading-text').textContent = text;
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
}

// =====================================================
// SUPABASE INITIALIZATION
// =====================================================
async function initSupabase() {
    try {
        console.log('[Init] Initializing Supabase...');
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
        
        console.log('[Init] Supabase client ready');
        return true;
    } catch (error) {
        console.error('[Init] Supabase error:', error);
        showToast('Gagal menghubungkan server', 'error');
        return false;
    }
}

// =====================================================
// AUTHENTICATION - Google Sign In
// =====================================================
async function signInWithGoogle() {
    if (!supabaseClient) return;

    const btn = document.querySelector('.login-btn-google');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <div style="width:16px;height:16px;border:2px solid #dadce0;border-top-color:#d97706;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;"></div>
            Menghubungkan...
        `;
    }

    try {
        const redirectTo = window.location.origin;
        console.log('[Auth] Redirecting to:', redirectTo);

        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo,
                queryParams: { access_type: 'offline', prompt: 'consent' }
            }
        });

        if (error) throw error;
    } catch (error) {
        console.error('[Auth] Sign in error:', error);
        showToast('Login gagal: ' + error.message, 'error');
        if (btn) {
            btn.disabled = false;
            renderLoginButton();
        }
    }
}

async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.reload();
}

// =====================================================
// CHECK AUTHENTICATION STATE
// =====================================================
async function checkAuth() {
    console.log('[Auth] Checking session...');

    try {
        // Handle OAuth callback
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            console.log('[Auth] Detected OAuth callback...');
            showLoading('Menyelesaikan login...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            window.history.replaceState(null, '', window.location.pathname);
        }

        // Get session
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        const authEl = document.getElementById('authSection');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        if (session?.user) {
            currentUser = session.user;
            console.log('[Auth] Logged in:', currentUser.email);

            // Get user metadata
            const meta = session.user.user_metadata || {};
            const name = meta.full_name || meta.name || currentUser.email.split('@')[0];
            const pic = meta.avatar_url || meta.picture;

            // Render logged in UI
            authEl.innerHTML = `
                <div class="user-profile">
                    <div class="user-avatar">${pic ? `<img src="${pic}" alt="" referrerpolicy="no-referrer">` : name[0].toUpperCase()}</div>
                    <div class="user-details">
                        <div class="user-name">${escapeHtml(name)}</div>
                        <div class="user-email-display">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                            </svg>
                            ${currentUser.email}
                        </div>
                        <span class="verified-badge">
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            OK
                        </span>
                    </div>
                </div>
                <button class="logout-btn" onclick="signOut()">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Keluar
                </button>
            `;

            statusDot.className = 'status-dot online';
            statusText.textContent = 'Online';

            // Show mode toggle and input area
            document.getElementById('chatModeSection').style.display = 'flex';
            document.getElementById('deleteAllBtn').style.display = 'flex';
            document.getElementById('inputArea').style.display = 'block';

            applyUIMode(currentUIMode);

            if (currentUIMode === 'project') {
                await loadProjects();
            }

            updateWelcome(true);

        } else {
            currentUser = null;
            renderLoginButton();

            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Belum login';

            document.getElementById('chatModeSection').style.display = 'none';
            document.getElementById('deleteAllBtn').style.display = 'none';
            document.getElementById('projectsList').style.display = 'none';
            updateWelcome(false);
        }

    } catch (error) {
        console.error('[Auth] Error:', error);
        showToast('Error autentikasi', 'error');
    }
}

/**
 * Render login button (not logged in state)
 */
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
// UI MODE: Quick Chat vs Project Mode
// =====================================================
function setChatMode(mode) {
    currentUIMode = mode;
    applyUIMode(mode);
}

function applyUIMode(mode) {
    const quickBtn = document.getElementById('quickChatModeBtn');
    const projBtn = document.getElementById('projectModeBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const newProjBtn = document.getElementById('newProjectBtn');
    const projList = document.getElementById('projectsList');
    const badge = document.getElementById('modeBadge');

    if (mode === 'quick') {
        quickBtn.classList.add('active');
        projBtn.classList.remove('active');
        newChatBtn.style.display = 'flex';
        newProjBtn.style.display = 'none';
        projList.style.display = 'none';
        badge.className = 'mode-badge quick';
        badge.textContent = 'Quick Chat';
        
        currentProject = null;
        currentSession = null;
        document.getElementById('currentChatTitle').textContent = 'Asisten-Ane - Quick Chat';
        
        if (currentUser) updateWelcome(true, 'quick');
    } else {
        quickBtn.classList.remove('active');
        projBtn.classList.add('active');
        newChatBtn.style.display = 'none';
        newProjBtn.style.display = 'flex';
        projList.style.display = 'block';
        badge.className = 'mode-badge project';
        badge.textContent = 'Project Mode';
        
        loadProjects();
        if (!currentProject) updateWelcome(true, 'project');
    }
}

function startNewQuickChat() {
    if (!currentUser) {
        showToast('Silakan login terlebih dahulu', 'warning');
        return;
    }
    currentProject = null;
    currentSession = crypto.randomUUID();
    document.getElementById('messagesContainer').innerHTML = '';
    addMessageToUI('assistant', 'Halo! Aku Asisten-Ane. Ada yang bisa aku bantu? 😊\n\nKamu sedang di mode *Quick Chat* - percakapan tidak tersimpan di project.');
}

// =====================================================
// DATABASE OPERATIONS
// =====================================================
async function loadProjects() {
    if (!currentUser) return [];
    
    try {
        const { data, error } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        projects = data || [];
        renderProjects();
        return projects;
    } catch (error) {
        console.error('[DB] Load projects error:', error);
        return [];
    }
}

async function loadSessions(projectId) {
    if (!currentUser) return [];
    
    try {
        const { data } = await supabaseClient
            .from('chat_history')
            .select('session_id, role, content, created_at')
            .eq('project_id', projectId)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
            
        const sessions = {};
        (data || []).forEach(msg => {
            if (!sessions[msg.session_id]) {
                sessions[msg.session_id] = {
                    id: msg.session_id,
                    last: msg.content.substring(0, 45),
                    time: msg.created_at
                };
            }
        });
        return Object.values(sessions);
    } catch (error) {
        return [];
    }
}

async function loadHistory(projectId, sessionId) {
    if (!currentUser) return [];
    
    try {
        const { data } = await supabaseClient
            .from('chat_history')
            .select('role, content')
            .eq('project_id', projectId)
            .eq('session_id', sessionId)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: true });
        return data || [];
    } catch (error) {
        return [];
    }
}

// =====================================================
// RENDER PROJECTS LIST
// =====================================================
function renderProjects() {
    const container = document.getElementById('projectsList');
    container.innerHTML = '<div class="section-divider">Projects</div>';

    if (projects.length === 0) {
        container.innerHTML += `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <p>Belum ada project.<br>Klik "Project Baru" untuk membuat.</p>
            </div>
        `;
        return;
    }

    projects.forEach(project => {
        const div = document.createElement('div');
        div.className = 'project-item';
        div.innerHTML = `
            <div class="project-header" onclick="toggleSessions('${project.id}')" ondblclick="selectProjectDirect(${JSON.stringify(project).replace(/"/g, '&quot;')})">
                <span class="project-name">
                    <span class="folder-icon">📁</span>
                    ${escapeHtml(project.name)}
                </span>
                <div class="project-actions">
                    <button onclick="event.stopPropagation(); deleteProject('${project.id}')" title="Hapus">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="sessions-list" id="sess-${project.id}"></div>
        `;
        container.appendChild(div);

        // Load sessions for this project
        loadSessions(project.id).then(sessions => {
            const sessContainer = document.getElementById(`sess-${project.id}`);
            if (sessContainer && sessions.length > 0) {
                sessions.forEach(session => {
                    const sd = document.createElement('div');
                    sd.className = 'session-item';
                    sd.onclick = () => selectProject(project, session.id);
                    sd.innerHTML = `
                        <span class="session-preview">💬 ${escapeHtml(session.last)}</span>
                        <button class="delete-session" onclick="event.stopPropagation(); deleteSession('${project.id}','${session.id}')">✕</button>
                    `;
                    sessContainer.appendChild(sd);
                });
            }
        });
    });
}

function toggleSessions(id) {
    const el = document.getElementById('sess-' + id);
    if (el) el.classList.toggle('open');
}

function selectProjectDirect(project) {
    selectProject(project);
}

async function selectProject(project) {
    currentProject = project;
    currentSession = null;
    document.getElementById('currentChatTitle').innerHTML = `📁 ${escapeHtml(project.name)}`;
    document.getElementById('messagesContainer').innerHTML = '';

    const sessions = await loadSessions(project.id);
    if (sessions.length > 0) {
        const div = document.createElement('div');
        div.className = 'sessions-container';
        div.innerHTML = '<h3>Percakapan di project ini:</h3>';
        
        sessions.forEach(session => {
            const b = document.createElement('button');
            b.className = 'session-history-btn';
            b.textContent = session.last + '...';
            b.onclick = () => selectSession(project, session.id);
            div.appendChild(b);
        });

        const nb = document.createElement('button');
        nb.className = 'new-chat-session-btn';
        nb.textContent = '+ Chat baru di project ini';
        nb.onclick = () => {
            currentSession = crypto.randomUUID();
            document.getElementById('messagesContainer').innerHTML = '';
            addMessageToUI('assistant', `Project: **${project.name}**\n\nHalo! Ada yang bisa aku bantu?`);
        };
        div.appendChild(nb);
        
        document.getElementById('messagesContainer').appendChild(div);
    } else {
        addMessageToUI('assistant', `Project: **${project.name}**\n\nSelamat datang! Mulai percakapan baru.`);
    }
}

async function selectSession(project, sessionId) {
    currentProject = project;
    currentSession = sessionId;
    document.getElementById('currentChatTitle').innerHTML = `💬 ${escapeHtml(project.name)}`;
    
    const history = await loadHistory(project.id, sessionId);
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    history.forEach(msg => addMessageToUI(msg.role, msg.content));
}

// =====================================================
// PROJECT CRUD OPERATIONS
// =====================================================
async function createProject() {
    const name = document.getElementById('projectNameInput').value.trim();
    if (!name) {
        showToast('Masukkan nama project', 'warning');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('projects')
            .insert({ name, user_id: currentUser.id })
            .select()
            .single();

        if (error) throw error;

        closeModal();
        await loadProjects();
        selectProject(data);
        showToast('Project dibuat!', 'success');
    } catch (error) {
        showToast('Gagal: ' + error.message, 'error');
    }
}

async function deleteProject(id) {
    if (!confirm('Hapus project & semua chat?')) return;
    
    await supabaseClient.from('chat_history').delete().eq('project_id', id).eq('user_id', currentUser.id);
    await supabaseClient.from('projects').delete().eq('id', id).eq('user_id', currentUser.id);
    
    await loadProjects();
    if (currentProject?.id === id) {
        currentProject = null;
        updateWelcome(true, 'project');
    }
}

async function deleteSession(projectId, sessionId) {
    if (!confirm('Hapus percakapan?')) return;
    
    await supabaseClient.from('chat_history').delete()
        .eq('project_id', projectId)
        .eq('session_id', sessionId)
        .eq('user_id', currentUser.id);
    
    await loadProjects();
    if (currentSession === sessionId) {
        currentSession = null;
        if (currentProject) selectProject(currentProject);
    }
}

async function deleteAll() {
    if (!confirm('HAPUS SEMUA DATA?')) return;
    
    await supabaseClient.from('chat_history').delete().eq('user_id', currentUser.id);
    await supabaseClient.from('projects').delete().eq('user_id', currentUser.id);
    
    await loadProjects();
    currentProject = null;
    currentSession = null;
    updateWelcome(true, currentUIMode);
}

// =====================================================
// MESSAGE FORMATTING WITH CODE HIGHLIGHTING & MATH SUPPORT
// =====================================================

/**
 * Format message content with:
 * - Code blocks with syntax highlighting (VSCode style)
 * - Copy button for each code block
 * - Math formula support (LaTeX via MathJax)
 * - Bold/italic markdown
 */
function formatMessage(content) {
    let formatted = escapeHtml(content);
    
    // Process code blocks with language support
    formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        const cleanCode = code.trim();
        const blockId = 'code-' + Math.random().toString(36).substr(2, 9);
        
        return `
            <div class="code-block-wrapper" id="${blockId}">
                <div class="code-block-header">
                    <span class="code-language">${language}</span>
                    <button class="code-copy-btn" onclick="copyCode('${blockId}', this)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                    </button>
                </div>
                <pre><code class="language-${language}">${cleanCode}</code></pre>
            </div>
        `;
    });
    
    // Process inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Process math formulas ($...$ or $$...$$)
    formatted = formatted.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        return `<div class="math-formula">$$${formula}$$</div>`;
    });
    formatted = formatted.replace(/\$([^$]+)\$/g, (match, formula) => {
        return `<span class="math-inline">$${formula}$</span>`;
    });
    
    // Process bold and italic
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Process line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

/**
 * Copy code from code block to clipboard
 */
async function copyCode(blockId, button) {
    const wrapper = document.getElementById(blockId);
    const codeElement = wrapper.querySelector('code');
    const code = codeElement.textContent;
    
    try {
        await navigator.clipboard.writeText(code);
        
        // Update button state
        button.classList.add('copied');
        button.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
        `;
        
        // Reset after 2 seconds
        setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
            `;
        }, 2000);
        
        showToast('Code copied!', 'success', 2000);
    } catch (error) {
        showToast('Failed to copy', 'error');
    }
}

/**
 * Re-highlight code blocks using Prism.js
 */
function highlightCodeBlocks() {
    if (typeof Prism !== 'undefined') {
        Prism.highlightAllUnder(document.getElementById('messagesContainer'));
    }
    
    // Re-render MathJax formulas
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
        MathJax.typesetPromise([document.getElementById('messagesContainer')])
            .catch(err => console.log('MathJax error:', err));
    }
}

// =====================================================
// MESSAGE UI FUNCTIONS
// =====================================================
function addMessageToUI(role, content) {
    const container = document.getElementById('messagesContainer');
    
    // Remove welcome screen if present
    if (container.querySelector('.welcome-screen')) {
        container.innerHTML = '';
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;
    wrapper.innerHTML = `
        <div class="message ${role}">
            <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
            <div class="message-content">${formatMessage(content)}</div>
        </div>
    `;
    
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    
    // Apply syntax highlighting and math rendering
    requestAnimationFrame(() => {
        highlightCodeBlocks();
    });
    
    return wrapper;
}

function addLoadingIndicator() {
    const container = document.getElementById('messagesContainer');
    
    if (container.querySelector('.welcome-screen')) {
        container.innerHTML = '';
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper assistant';
    wrapper.id = 'loading-msg';
    wrapper.innerHTML = `
        <div class="message assistant">
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function removeLoadingIndicator() {
    const element = document.getElementById('loading-msg');
    if (element) element.remove();
}

// =====================================================
// SEND MESSAGE
// =====================================================
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || isLoading) return;
    if (!currentUser) {
        showToast('Silakan login terlebih dahulu', 'warning');
        return;
    }

    input.value = '';
    isLoading = true;
    document.getElementById('sendBtn').disabled = true;

    // Add user message
    addMessageToUI('user', message);

    // Generate session ID if needed
    if (!currentSession) {
        currentSession = crypto.randomUUID();
    }

    addLoadingIndicator();

    try {
        // Get access token from Supabase session
        const { data: { session } } = await supabaseClient.auth.getSession();
        const token = session?.access_token;

        if (!token) {
            throw new Error('Token tidak ditemukan. Silakan login ulang.');
        }

        const projectId = currentProject ? currentProject.id : null;
        const isGuestMode = (currentUIMode === 'quick');
        
        // Build request payload
        const payload = {
            message: message,
            session_id: currentSession,
            stream: true
        };
        
        if (!isGuestMode && projectId) {
            payload.project_id = projectId;
        }
        
        if (isGuestMode) {
            payload.guest_mode = true;
        }

        console.log('[Chat] Sending request...');

        // Send to API
        const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-ane`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = '';
        let aiElement = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            decoder.decode(value).split('\n').forEach(line => {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') return;
                    
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        
                        if (content) {
                            aiResponse += content;
                            
                            if (!aiElement) {
                                removeLoadingIndicator();
                                aiElement = addMessageToUI('assistant', aiResponse);
                            } else {
                                aiElement.querySelector('.message-content').innerHTML = formatMessage(aiResponse);
                                highlightCodeBlocks();
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors for incomplete chunks
                    }
                }
            });
        }

        // Refresh projects list if in project mode
        if (currentProject && !isGuestMode) {
            await loadProjects();
        }

    } catch (error) {
        console.error('[Chat] Error:', error);
        removeLoadingIndicator();
        addMessageToUI('assistant', 'Maaf, terjadi kesalahan: ' + error.message);
    } finally {
        isLoading = false;
        document.getElementById('sendBtn').disabled = false;
        input.focus();
    }
}

/**
 * Handle keyboard input
 */
function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// =====================================================
// WELCOME SCREEN
// =====================================================
function updateWelcome(loggedIn, mode = 'quick') {
    const container = document.getElementById('messagesContainer');
    
    if (!loggedIn) {
        container.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-icon">🤖</div>
                <h2>Selamat Datang!</h2>
                <p>Login dengan Google untuk mulai.</p>
                <div class="example-prompts">
                    <div class="example-prompt" onclick="setExamplePrompt('Hello')"><span>👋</span> Sapa</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Siapa kamu?')"><span>🤖</span> Tentang kamu</div>
                </div>
            </div>`;
    } else if (mode === 'quick') {
        container.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-icon">⚡</div>
                <h2>Quick Chat</h2>
                <p>Chat cepat tanpa project.</p>
                <div class="example-prompts">
                    <div class="example-prompt" onclick="setExamplePrompt('Buatkan HTML sederhana')"><span>💻</span> HTML</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Jelaskan AI')"><span>🧠</span> AI</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Tips coding')"><span>💡</span> Tips</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Hitung integral ∫x²dx')"><span>🔢</span> Matematika</div>
                </div>
            </div>`;
    } else {
        container.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-icon">📁</div>
                <h2>Project Mode</h2>
                <p>Pilih project atau buat baru.</p>
                <div class="example-prompts">
                    <div class="example-prompt" onclick="setExamplePrompt('Buatkan API REST')"><span>🔧</span> API</div>
                    <div class="example-prompt" onclick="setExamplePrompt('Database schema')"><span>🗄️</span> DB</div>
                </div>
            </div>`;
    }
}

function setExamplePrompt(prompt) {
    if (!currentUser) {
        showToast('Login dulu ya!', 'warning');
        return;
    }
    document.getElementById('messageInput').value = prompt;
    sendMessage();
}

// =====================================================
// MODAL & THEME TOGGLE
// =====================================================
function showNewProjectModal() {
    document.getElementById('newProjectModal').classList.add('show');
    document.getElementById('projectNameInput').value = '';
    setTimeout(() => document.getElementById('projectNameInput').focus(), 100);
}

function closeModal() {
    document.getElementById('newProjectModal').classList.remove('show');
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.getElementById('themeIcon');
    const isDark = document.body.classList.contains('dark');
    
    icon.innerHTML = isDark
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}

// =====================================================
// EVENT LISTENERS
// =====================================================

// Modal close on outside click
document.getElementById('newProjectModal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
});

// Modal close on Escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
});

// Textarea auto-resize
const textarea = document.getElementById('messageInput');
textarea.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 130) + 'px';
});

// Textarea enter key handler
textarea.addEventListener('keydown', handleKeydown);

// =====================================================
// INITIALIZATION
// =====================================================
async function init() {
    console.log('[Init] Starting application...');

    // Load saved theme preference
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');
    }
    updateThemeIcon();

    // Initialize Supabase
    const success = await initSupabase();
    if (!success) {
        hideLoading();
        renderLoginButton();
        return;
    }

    // Check authentication
    await checkAuth();

    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] State change:', event);
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            setTimeout(() => window.location.reload(), 800);
        }
    });

    hideLoading();
    console.log('[Init] Application ready!');
}

// Start the app
init();