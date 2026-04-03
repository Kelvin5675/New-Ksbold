/* ============================================================
   KSBOLD — Script do Painel Admin
   ============================================================ */

// ======== CONFIGURAÇÃO SUPABASE ========
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.KSBOLD_CONFIG || {};

let supabaseClient = null;

// Inicializar Supabase com verificação
try {
    if (window.supabase && SUPABASE_URL) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client criado com sucesso');

        // ======== MONITORAR VISITANTES ONLINE (REALTIME PRESENCE) ========
        const presenceChannel = supabaseClient.channel('online-users');
        
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                const count = Object.keys(state).length;
                console.log('👥 Presença sincronizada. Online agora:', count);
                updateOnlineCount(count);
            })
            .on('presence', { event: 'join', filter: { type: 'visitor' } }, ({ key, newPresences }) => {
                console.log('👋 Novo visitante entrou:', key, newPresences);
            })
            .on('presence', { event: 'leave', filter: { type: 'visitor' } }, ({ key, leftPresences }) => {
                console.log('🏃 Visitante saiu:', key, leftPresences);
            });

        presenceChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Inscrito no canal Realtime: online-users');
            } else {
                console.warn('⚠️ Status do canal Realtime:', status);
            }
        });

        function updateOnlineCount(count) {
            const statEl = document.getElementById('stat-users');
            const dotEl = document.getElementById('online-dot');
            if (statEl) statEl.textContent = count;
            if (dotEl) {
                const isOnline = count > 0;
                dotEl.style.background = isOnline ? '#22c55e' : '#ef4444';
                dotEl.style.setProperty('--pulse-color', isOnline ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)');
                dotEl.title = isOnline ? `${count} visitante(s) no site` : 'Nenhum visitante no momento';
            }
        }

        // Estado inicial
        const statEl = document.getElementById('stat-users');
        if (statEl) statEl.textContent = 'Sincronizando...';
    } else {
        console.error('❌ Supabase JS não carregou. Verifique a conexão de internet.');
    }
} catch (e) {
    console.error('❌ Erro ao criar Supabase client:', e);
}

// ======== NOTIFICAÇÕES PREMIUM (CUSTOM MODALS) ========

/**
 * Mostra um alerta personalizado com tema KSBOLD
 */
function showKSAlert(message, title = 'KSBOLD') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ks-modal-overlay';
        overlay.innerHTML = `
            <div class="ks-modal">
                <div class="ks-modal-icon">✨</div>
                <div class="ks-modal-title">${title}</div>
                <div class="ks-modal-message">${message}</div>
                <div class="ks-modal-actions">
                    <button class="ks-modal-btn ks-modal-btn-primary">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Trigger animation
        setTimeout(() => overlay.classList.add('visible'), 10);

        overlay.querySelector('.ks-modal-btn-primary').onclick = () => {
            overlay.classList.remove('visible');
            setTimeout(() => {
                document.body.removeChild(overlay);
                resolve();
            }, 300);
        };
    });
}

/**
 * Mostra um diálogo de confirmação personalizado com tema KSBOLD
 */
function showKSConfirm(message, title = 'Confirmar') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ks-modal-overlay';
        overlay.innerHTML = `
            <div class="ks-modal">
                <div class="ks-modal-icon">❓</div>
                <div class="ks-modal-title">${title}</div>
                <div class="ks-modal-message">${message}</div>
                <div class="ks-modal-actions">
                    <button class="ks-modal-btn ks-modal-btn-secondary">Cancelar</button>
                    <button class="ks-modal-btn ks-modal-btn-primary">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => overlay.classList.add('visible'), 10);

        const close = (result) => {
            overlay.classList.remove('visible');
            setTimeout(() => {
                document.body.removeChild(overlay);
                resolve(result);
            }, 300);
        };

        overlay.querySelector('.ks-modal-btn-primary').onclick = () => close(true);
        overlay.querySelector('.ks-modal-btn-secondary').onclick = () => close(false);
    });
}


// ======== LOGIN ========

/**
 * Trata o envio do formulário de login
 */
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('btn-authenticate');

    errorEl.textContent = '';
    btn.textContent = 'AUTHENTICATING...';
    btn.disabled = true;

    // Tentar login via Supabase Auth
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (!error && data && data.user) {
                console.log('✅ Login Supabase bem-sucedido:', data.user.email);
                document.getElementById('logged-user-email').textContent = data.user.email;
                showDashboard();
                return;
            }

            // Mostrar erro real do Supabase para debug
            if (error) {
                console.warn('⚠️ Supabase auth error:', error.message);
                errorEl.textContent = 'Erro: ' + error.message;
                btn.textContent = 'AUTHENTICATE';
                btn.disabled = false;
                return;
            }
        } catch (err) {
            console.error('❌ Erro de conexão Supabase:', err);
            errorEl.textContent = 'Erro de conexão. Verifique sua internet.';
            btn.textContent = 'AUTHENTICATE';
            btn.disabled = false;
            return;
        }
    }

    // Fallback — login local
    if (email === 'admin@ksbold.com' && password === 'admin123') {
        document.getElementById('logged-user-email').textContent = email;
        showDashboard();
    } else {
        errorEl.textContent = 'Credenciais inválidas.';
        btn.textContent = 'AUTHENTICATE';
        btn.disabled = false;
    }
}

/**
 * Mostra o dashboard e esconde o login
 */
function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'flex';
    
    // Salvar sessão por 1 hora
    const email = document.getElementById('logged-user-email').textContent;
    if (email && email !== '...') {
        localStorage.setItem('ksbold_admin_session', JSON.stringify({
            email: email,
            timestamp: Date.now()
        }));
    }

    loadDashboardData();
    initGlobalChatListener(); // Ativar Realtime para notificações e mensagens em tempo real
}

/**
 * Verifica se há uma sessão ativa e válida (1 hora)
 */
function checkSession() {
    const sessionStr = localStorage.getItem('ksbold_admin_session');
    if (!sessionStr) return;

    try {
        const session = JSON.parse(sessionStr);
        const oneHour = 60 * 60 * 1000;
        const now = Date.now();

        if (now - session.timestamp < oneHour) {
            console.log('✨ Sessão restaurada para:', session.email);
            document.getElementById('logged-user-email').textContent = session.email;
            showDashboard();
        } else {
            console.log('⏰ Sessão expirada.');
            localStorage.removeItem('ksbold_admin_session');
        }
    } catch (e) {
        console.error('Erro ao verificar sessão:', e);
    }
}

/**
 * Encerra a sessão do administrador
 */
function handleLogout() {
    if (confirm('Deseja realmente sair do painel administrativo?')) {
        localStorage.removeItem('ksbold_admin_session');
        location.reload();
    }
}

/**
 * Alterna visibilidade da senha
 */
function togglePassword() {
    const input = document.getElementById('login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ======== NAVEGAÇÃO DO SIDEBAR ========

function switchSection(sectionId, navEl) {
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const section = document.getElementById('section-' + sectionId);
    if (section) section.style.display = 'block';
    if (navEl) navEl.classList.add('active');

    const titles = {
        geral: 'Visão Geral',
        vendas: 'Vendas',
        galeria: 'Galeria',
        config: 'Configurações',
        telemetria: 'Funil ao Vivo'
    };
    document.getElementById('page-title').textContent = titles[sectionId] || 'Visão Geral';

    document.getElementById('sidebar').classList.remove('open');

    if (sectionId === 'vendas') loadAllOrders();
    if (sectionId === 'config') { loadConfigData(); loadWhatsAppConfig(); }
    if (sectionId === 'galeria') loadGallery();
    if (sectionId === 'telemetria') { initFunnelPresence(); loadDesistenciaData('hoje'); }

    if (window.event) window.event.preventDefault();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ======== HELPER: Requisição Supabase segura ========

/**
 * Wrapper para chamadas Supabase com tratamento de erro detalhado
 */
async function safeSupabaseCall(description, callback) {
    if (!supabaseClient) {
        console.warn('Supabase não disponível para:', description);
        return { data: null, error: { message: 'Supabase não configurado' } };
    }

    try {
        const result = await callback(supabaseClient);
        if (result.error) {
            console.error(`❌ Erro em ${description}:`, result.error.message, result.error);
        } else {
            console.log(`✅ ${description}: sucesso`);
        }
        return result;
    } catch (e) {
        console.error(`❌ Exceção em ${description}:`, e);
        return { data: null, error: { message: e.message || 'Erro desconhecido' } };
    }
}

// ======== CARREGAR DADOS DO DASHBOARD ========

async function loadDashboardData() {
    console.log('📊 Carregando dados do dashboard...');
    await Promise.all([
        loadStats(),
        loadPixelSettings(),
        loadPriceButtons(),
        loadRecentOrders()
    ]);

    // Inicia ouvidos do Chat Central (Admin CRM Inbox)
    initGlobalChatListener();
    loadChatInbox(true);

    console.log('📊 Dashboard carregado e Chat CRM Active.');
}

async function loadStats(filter = 'all') {
    const ordersEl = document.getElementById('stat-orders');
    const revenueEl = document.getElementById('stat-revenue');
    const usersEl = document.getElementById('stat-users');

    ordersEl.textContent = '...';
    revenueEl.textContent = '...';

    const { data: ordersData, error } = await safeSupabaseCall('carregar pedidos (stats)', async (sb) => {
        let query = sb.from('orders').select('id, preco, created_at');
        
        if (filter !== 'all') {
            const now = new Date();
            let startDate = new Date();
            
            if (filter === 'today') {
                startDate.setHours(0, 0, 0, 0);
            } else if (filter === 'week') {
                startDate.setDate(now.getDate() - 7);
                startDate.setHours(0, 0, 0, 0);
            } else if (filter === 'month') {
                startDate.setMonth(now.getMonth() - 1);
                startDate.setHours(0, 0, 0, 0);
            }
            
            const isoDate = startDate.toISOString();
            console.log(`🔍 Filtrando desde: ${isoDate} (Filtro: ${filter})`);
            query = query.gte('created_at', isoDate);
        }
        
        return await query;
    });

    if (!error && ordersData) {
        console.log(`✅ ${ordersData.length} pedidos encontrados para o filtro: ${filter}`);
        // Contar quadros totais
        const totalFrames = ordersData.length;

        // Contar vendas únicas (grupos)
        const uniqueSales = new Set(ordersData.map(o => {
            const match = o.id.match(/KS-\d+/);
            return match ? match[0] : o.id;
        })).size;

        ordersEl.textContent = `${uniqueSales} (${totalFrames} quadros)`;
        const total = ordersData.reduce((sum, o) => sum + Number(o.preco || 0), 0);
        revenueEl.textContent = 'MT ' + total.toLocaleString('pt-MZ', { minimumFractionDigits: 2 });
    } else if (error) {
        ordersEl.textContent = 'Erro';
        revenueEl.textContent = 'Erro';
    }

    // A contagem de pessoas online agora é gerida em tempo real pelo Realtime Presence
    // (ver listener no topo do arquivo). Não sobrescrevemos aqui com o histórico.
}


// ======== META PIXEL ========

async function loadPixelSettings() {
    const { data, error } = await safeSupabaseCall('carregar pixel', async (sb) => {
        return await sb.from('settings').select('meta_pixel_id, pixel_ativo').eq('id', 1).single();
    });

    if (!error && data) {
        document.getElementById('pixel-id-input').value = data.meta_pixel_id || '';
        document.getElementById('pixel-toggle').checked = data.pixel_ativo || false;
    }
}

async function savePixelSettings() {
    const pixelId = document.getElementById('pixel-id-input').value.trim();
    const pixelAtivo = document.getElementById('pixel-toggle').checked;

    const { error } = await safeSupabaseCall('salvar pixel', async (sb) => {
        return await sb.from('settings').upsert({ id: 1, meta_pixel_id: pixelId, pixel_ativo: pixelAtivo });
    });

    if (!error) {
        showKSAlert('✅ Configuração do Pixel atualizada com sucesso!');
    } else {
        showKSAlert('❌ Erro ao salvar pixel: ' + error.message + '\n\nVerifique se executou o SQL de configuração RLS no Supabase.');
    }
}

async function savePixelFromConfig() {
    const pixelId = document.getElementById('config-pixel-id').value.trim();
    const capiToken = document.getElementById('config-capi-token').value.trim();
    const pixelAtivo = document.getElementById('config-pixel-toggle').checked;

    // Salvar Pixel ID e toggle na tabela settings
    const { error } = await safeSupabaseCall('salvar pixel (config)', async (sb) => {
        return await sb.from('settings').upsert({ id: 1, meta_pixel_id: pixelId, pixel_ativo: pixelAtivo });
    });

    // Salvar Token CAPI na tabela bot_settings (cofre seguro)
    if (capiToken) {
        await safeSupabaseCall('salvar capi token', async (sb) => {
            return await sb.from('bot_settings').upsert({ key: 'meta_capi_token', value: capiToken }, { onConflict: 'key' });
        });
    }
    // Salvar Pixel ID tambem no bot_settings para o Python ler
    if (pixelId) {
        await safeSupabaseCall('salvar pixel id bot', async (sb) => {
            return await sb.from('bot_settings').upsert({ key: 'meta_pixel_id', value: pixelId }, { onConflict: 'key' });
        });
    }

    if (!error) {
        document.getElementById('pixel-id-input').value = pixelId;
        document.getElementById('pixel-toggle').checked = pixelAtivo;
        showKSAlert('✅ Pixel ID + Token CAPI salvos com sucesso!\n\nO bot vai enviar eventos de compra diretamente ao Facebook.');
    } else {
        showKSAlert('❌ Erro ao salvar: ' + error.message);
    }
}

async function saveCeoAlertConfig() {
    const ceoPhone = document.getElementById('config-ceo-whatsapp').value.trim();
    const alertsAtivo = document.getElementById('config-ceo-alerts-toggle').checked;

    if (!ceoPhone) {
        showKSAlert('⚠️ Insira o seu número de WhatsApp para receber alertas.');
        return;
    }

    const { error: e1 } = await safeSupabaseCall('salvar ceo whatsapp', async (sb) => {
        return await sb.from('bot_settings').upsert({ key: 'ceo_whatsapp', value: ceoPhone }, { onConflict: 'key' });
    });
    const { error: e2 } = await safeSupabaseCall('salvar ceo alerts toggle', async (sb) => {
        return await sb.from('bot_settings').upsert({ key: 'ceo_alerts_ativo', value: alertsAtivo ? 'true' : 'false' }, { onConflict: 'key' });
    });

    if (!e1 && !e2) {
        showKSAlert('✅ Alertas de vendas configurados!\n\nVocê receberá uma mensagem no WhatsApp sempre que uma nova venda entrar.');
    } else {
        showKSAlert('❌ Erro ao salvar: ' + ((e1 || e2)?.message || 'Erro desconhecido'));
    }
}

// ======== PREÇOS ========

async function loadPriceButtons() {
    const container = document.getElementById('price-buttons');
    const sizes = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];

    container.innerHTML = '';
    sizes.forEach(size => {
        const btn = document.createElement('div');
        btn.className = 'price-btn';
        btn.innerHTML = `
      <span class="price-size-label">${size}</span>
      <span class="price-adjust-text">ADJUST</span>
    `;
        btn.onclick = () => switchSection('config', document.querySelector('[data-section=config]'));
        container.appendChild(btn);
    });
}

async function loadConfigData() {
    // Carregar pixel
    const { data: pixelData } = await safeSupabaseCall('carregar pixel (config)', async (sb) => {
        return await sb.from('settings').select('meta_pixel_id, pixel_ativo').eq('id', 1).single();
    });

    if (pixelData) {
        document.getElementById('config-pixel-id').value = pixelData.meta_pixel_id || '';
        document.getElementById('config-pixel-toggle').checked = pixelData.pixel_ativo || false;
    }

    // Carregar Token CAPI e Alertas do CEO da tabela bot_settings
    const { data: botSettings } = await safeSupabaseCall('carregar capi+ceo config', async (sb) => {
        return await sb.from('bot_settings').select('key, value').in('key', ['meta_capi_token', 'ceo_whatsapp', 'ceo_alerts_ativo']);
    });

    if (botSettings) {
        const getVal = (key) => botSettings.find(s => s.key === key)?.value || '';
        const capiInput = document.getElementById('config-capi-token');
        const ceoInput = document.getElementById('config-ceo-whatsapp');
        const ceoToggle = document.getElementById('config-ceo-alerts-toggle');
        if (capiInput) capiInput.value = getVal('meta_capi_token');
        if (ceoInput) ceoInput.value = getVal('ceo_whatsapp');
        if (ceoToggle) ceoToggle.checked = getVal('ceo_alerts_ativo') === 'true';
    }

    // Carregar preços
    const form = document.getElementById('config-prices-form');
    const sizes = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
    const defaults = { A0: 600, A1: 380, A2: 250, A3: 180, A4: 120, A5: 80 };
    let prices = {};

    const { data: priceData } = await safeSupabaseCall('carregar preços', async (sb) => {
        return await sb.from('prices').select('tamanho, preco');
    });

    if (priceData) {
        priceData.forEach(p => { prices[p.tamanho] = p.preco; });
    }

    form.innerHTML = '';
    sizes.forEach(size => {
        const value = prices[size] || defaults[size] || 0;
        const row = document.createElement('div');
        row.style.marginBottom = '10px';
        row.innerHTML = `
      <label class="form-label-admin">${size}</label>
      <input type="number" class="admin-input price-config-input" data-size="${size}" value="${value}" step="0.01" min="0" placeholder="Preço em MT">
    `;
        form.appendChild(row);
    });
}

async function savePricesFromConfig() {
    const inputs = document.querySelectorAll('.price-config-input');
    const updates = [];

    inputs.forEach(input => {
        updates.push({
            tamanho: input.getAttribute('data-size'),
            preco: parseFloat(input.value) || 0
        });
    });

    // Salvar cada preço individualmente para evitar problemas com upsert
    let hasError = false;
    for (const item of updates) {
        const { error } = await safeSupabaseCall(`salvar preço ${item.tamanho}`, async (sb) => {
            return await sb.from('prices').upsert(item, { onConflict: 'tamanho' });
        });
        if (error) {
            hasError = true;
            break;
        }
    }

    if (!hasError) {
        showKSAlert('✅ Preços atualizados com sucesso!');
    } else {
        showKSAlert('❌ Erro ao salvar preços.\n\nVerifique se:\n1. As tabelas foram criadas no Supabase\n2. O RLS está desactivado ou com políticas correctas\n\nVeja o console (F12) para detalhes.');
    }
}

// ======== PEDIDOS ========

let allOrdersData = []; // Cache para busca local rápida

async function loadRecentOrders() {
    const tbody = document.getElementById('orders-table-body');

    const { data, error } = await safeSupabaseCall('carregar pedidos recentes', async (sb) => {
        return await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(5);
    });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">
      Erro ao carregar pedidos: ${error.message}<br>
      <small>Verifique o console (F12) para mais detalhes.</small>
    </td></tr>`;
        return;
    }

    allOrdersData = data || [];
    renderOrders(tbody, data);
}

async function loadAllOrders() {
    const tbody = document.getElementById('all-orders-table-body');

    const { data, error } = await safeSupabaseCall('carregar todos os pedidos', async (sb) => {
        return await sb.from('orders').select('*').order('created_at', { ascending: false });
    });

    if (!error && data) {
        allOrdersData = data || []; // Atualiza o cache também para a aba "Vendas"
    }

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">Erro: ${error.message}</td></tr>`;
        return;
    }

    renderOrders(tbody, data);
}

function renderOrders(tbody, orders) {
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:24px;">Nenhum pedido encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    orders.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('pt-MZ', {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        const statusClass = (order.status || '').toLowerCase();
        const displayStatus = order.status || 'Pendente';

        const tr = document.createElement('tr');
        tr.className = 'clickable-row';
        tr.onclick = () => openOrderDetail(order.id);

        // Detectar se é parte de um grupo (ex: KS-1234-1)
        const groupMatch = order.id.match(/(KS-\d+)-(\d+)/);
        const groupId = groupMatch ? groupMatch[1] : null;
        let qtdInfo = '1 quadro';

        if (groupId) {
            const groupCount = orders.filter(o => o.id.includes(groupId)).length;
            qtdInfo = `${groupCount} quadros`;
        }

        tr.innerHTML = `
      <td onclick="event.stopPropagation()">
        <input type="checkbox" class="order-checkbox" data-id="${order.id}" onchange="updateSelectedCount()">
      </td>
      <td>
        <span class="order-id">#${order.id}</span>
        ${groupId ? `<br><small style="color:#999;font-size:10px;">Grupo: ${groupId}</small>` : ''}
      </td>
      <td>
        <span class="status-badge ${statusClass}">${order.tamanho}</span>
        <div style="font-size:11px; margin-top:4px; color:#666;">${qtdInfo}</div>
      </td>
      <td>MT ${Number(order.preco || 0).toFixed(2)}</td>
      <td>${date}</td>
      <td>
        <select class="status-select" onclick="event.stopPropagation()" onchange="updateOrderStatus('${order.id}', this.value)">
          <option value="Pendente" ${displayStatus === 'Pendente' ? 'selected' : ''}>Pendente</option>
          <option value="Completo" ${displayStatus === 'Completo' ? 'selected' : ''}>Completo</option>
          <option value="Cancelado" ${displayStatus === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
      </td>
      <td onclick="event.stopPropagation()" style="display: flex; gap: 4px; border-bottom: none;">
          <button class="action-btn" title="Ver Detalhes" onclick="openOrderDetail('${order.id}')">👁️</button>
          <button class="action-btn" title="Fatura PDF" onclick="generateOrderPDF('${order.id}')">📄</button>
          <button class="action-btn delete" title="Eliminar pedido" onclick="deleteOrder('${order.id}')">🗑️</button>
      </td>
    `;
        tbody.appendChild(tr);
    });

    // Resetar master checkbox
    const master = document.getElementById('select-all-orders');
    if (master) master.checked = false;
    updateSelectedCount();
}

function toggleSelectAll(master) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = master.checked);
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const count = checkboxes.length;
    const bar = document.getElementById('bulk-actions');
    const countEl = document.getElementById('selected-count');

    if (count > 0) {
        if (bar) bar.style.display = 'flex';
        if (countEl) countEl.textContent = count;
    } else {
        if (bar) bar.style.display = 'none';
    }
}

async function deleteSelectedOrders() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

    if (ids.length === 0) return;

    if (!await showKSConfirm(`Tem certeza que deseja eliminar ${ids.length} pedido(s) selecionado(s)?\n\nEsta ação é permanente.`)) return;

    const { error } = await safeSupabaseCall('eliminar múltiplos pedidos', async (sb) => {
        return await sb.from('orders').delete().in('id', ids);
    });

    if (error) {
        showKSAlert('❌ Erro ao eliminar: ' + error.message);
    } else {
        showKSAlert(`✅ ${ids.length} pedido(s) eliminado(s) com sucesso!`);
        // Recarregar todas as visualizações
        loadRecentOrders();
        loadAllOrders();
        loadStats(document.getElementById('stats-filter')?.value || 'all');
    }
}

async function updateOrderStatus(orderId, newStatus) {
    const { error } = await safeSupabaseCall('atualizar status', async (sb) => {
        return await sb.from('orders').update({ status: newStatus }).eq('id', orderId);
    });

    if (error) {
        showKSAlert('❌ Erro ao atualizar: ' + error.message);
    } else {
        // 1. Atualizar no cache local e recarregar stats
        const order = allOrdersData.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        loadStats();

        // 2. Enviar mensagem automática no chat do cliente
        try {
            await safeSupabaseCall('enviar notificacao de status no chat', async (sb) => {
                return await sb.from('messages').insert([{
                    order_id: orderId,
                    sender_type: 'system',
                    content_type: 'text',
                    content: { text: `📢 Atualização: O seu pedido está agora ${newStatus.toUpperCase()}.` }
                }]);
            });

            // Se o chat deste pedido estiver aberto, recarregar
            const currentPrefix = orderId.split('-').slice(0, 2).join('-');
            const activePrefix = activeChatOrderId ? activeChatOrderId.split('-').slice(0, 2).join('-') : null;
            if (activePrefix === currentPrefix) {
                loadAdminChatHistory(orderId);
            }
        } catch (e) { console.error("Erro ao notificar no chat:", e); }
    }
}

async function deleteOrder(orderId) {
    if (!await showKSConfirm(`Tem certeza que deseja eliminar o pedido #${orderId}?`)) return;

    const { error } = await safeSupabaseCall('eliminar pedido', async (sb) => {
        return await sb.from('orders').delete().eq('id', orderId);
    });

    if (error) {
        showKSAlert('❌ Erro ao eliminar: ' + error.message);
    } else {
        showKSAlert('✅ Pedido eliminado com sucesso!');
        // Recarregar tudo
        loadRecentOrders();
        loadAllOrders();
        loadStats(document.getElementById('stats-filter')?.value || 'all');
    }
}

async function resetSystemData() {
    const confirm1 = await showKSConfirm('⚠️ ATENÇÃO: Você está prestes a apagar TODOS os pedidos e mensagens do sistema.\n\nEsta ação é irreversível e deve ser feita apenas ANTES do lançamento oficial para limpar dados de teste.\n\nDeseja continuar?');
    if (!confirm1) return;

    const confirm2 = await showKSConfirm('🚨 ÚLTIMO AVISO: Tem certeza ABSOLUTA? Todos os pedidos e conversas de teste serão eliminados permanentemente.');
    if (!confirm2) return;

    const { error } = await safeSupabaseCall('reset completo do sistema', async (sb) => {
        // Deletar todos os pedidos (mensagens seguem via CASCADE)
        return await sb.from('orders').delete().neq('id', 'void-placeholder');
    });

    if (error) {
        showKSAlert('❌ Erro no reset: ' + error.message);
    } else {
        showKSAlert('🚀 Sistema resetado com sucesso! Agora você pode começar com dados reais.');
        location.reload();
    }
}

// ======== DETALHES DO PEDIDO ========

async function openOrderDetail(orderId) {
    const overlay = document.getElementById('order-detail-overlay');
    const container = document.getElementById('detail-body');

    container.innerHTML = '<p style="text-align:center;padding:40px;">Carregando detalhes...</p>';
    overlay.classList.add('visible');

    // Buscar dados mais recentes
    const { data: order, error } = await safeSupabaseCall('carregar detalhe', async (sb) => {
        return await sb.from('orders').select('*').eq('id', orderId).single();
    });

    if (error || !order) {
        container.innerHTML = '<p style="color:red;padding:20px;">Erro ao carregar detalhes.</p>';
        return;
    }

    // Buscar outros itens do mesmo grupo se existir
    const groupMatch = order.id.match(/(KS-\d+)-(\d+)/);
    let otherItemsHtml = '';

    if (groupMatch) {
        const groupId = groupMatch[1];
        const { data: groupItems } = await safeSupabaseCall('buscar itens do grupo', async (sb) => {
            return await sb.from('orders').select('id, tamanho, imagem_url').ilike('id', `${groupId}-%`);
        });

        if (groupItems && groupItems.length > 1) {
            otherItemsHtml = `
                <div class="detail-group-items">
                    <h4>Itens Deste Pedido (${groupItems.length}):</h4>
                    <div class="group-items-grid">
                        ${groupItems.map(item => `
                            <div class="group-item-mini ${item.id === orderId ? 'active' : ''}" onclick="event.stopPropagation(); openOrderDetail('${item.id}')">
                                <img src="${item.imagem_url || ''}" alt="Quadro">
                                <span>${item.tamanho}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    const date = new Date(order.created_at).toLocaleString('pt-MZ');
    const statusClass = (order.status || 'pendente').toLowerCase();

    const clientName = order.client_name || 'Não informado';
    const clientPhone = order.client_phone || 'Não informado';

    container.innerHTML = `
        <div class="detail-image-container">
            ${order.imagem_url
            ? `<img src="${order.imagem_url}" alt="Foto do pedido" onclick="viewOrderImage('${order.imagem_url}')" style="cursor:zoom-in">`
            : '<div class="no-image">Nenhuma imagem carregada para este pedido.</div>'}
        </div>

        ${otherItemsHtml}

        <div style="background:linear-gradient(135deg, #1a1a2e, #16213e); border-radius:12px; padding:16px; margin-bottom:16px; border:1px solid rgba(212,184,150,0.2);">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#d4b896; margin-bottom:10px; font-weight:600;">👤 DADOS DO CLIENTE</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                    <div style="font-size:10px; color:#888; text-transform:uppercase;">NOME</div>
                    <div style="font-size:15px; color:#fff; font-weight:600;">${clientName}</div>
                </div>
                <div>
                    <div style="font-size:10px; color:#888; text-transform:uppercase;">WHATSAPP</div>
                    <div style="font-size:15px; color:#fff; font-weight:600;">${clientPhone}</div>
                </div>
            </div>
        </div>

        <div class="detail-info-grid">
            <div class="detail-info-item">
                <div class="detail-info-label">ID DO PEDIDO</div>
                <div class="detail-info-value">#${order.id}</div>
            </div>
            <div class="detail-info-item">
                <div class="detail-info-label">STATUS</div>
                <div class="detail-status-badge ${statusClass}">${order.status || 'Pendente'}</div>
            </div>
            <div class="detail-info-item">
                <div class="detail-info-label">TAMANHO</div>
                <div class="detail-info-value">${order.tamanho}</div>
            </div>
            <div class="detail-info-item">
                <div class="detail-info-label">PREÇO TOTAL</div>
                <div class="detail-info-value price">MT ${Number(order.preco || 0).toFixed(2)}</div>
            </div>
            <div class="detail-info-item full-width">
                <div class="detail-info-label">DATA E HORA DO PEDIDO</div>
                <div class="detail-info-value">${date}</div>
            </div>
        </div>

        <div class="detail-actions">
            <button class="btn-detail-view" onclick="viewOrderImage('${order.imagem_url || ''}')">Visualizar Cheio</button>
            <button class="btn-detail-download" onclick="downloadImage('${order.imagem_url || ''}', 'pedido_${order.id}')">Baixar Imagem</button>
            <button class="btn-detail-download" style="background:linear-gradient(135deg,#d4b896,#b8956a);color:#0a0a0f;" onclick="generateOrderPDF('${order.id}')">📄 Gerar Fatura PDF</button>
        </div>
    `;
}

function closeOrderDetail() {
    document.getElementById('order-detail-overlay').classList.remove('visible');
}

// ======== AUXILIARES MODAL E DOWNLOAD ========

async function viewOrderImage(url) {
    if (!url) { showKSAlert('Nenhuma imagem disponível.'); return; }
    const img = document.getElementById('modal-image');
    img.src = url;
    document.getElementById('image-modal').classList.add('visible');
}

function closeImageModal() {
    document.getElementById('image-modal').classList.remove('visible');
}

/**
 * Força o download real do ficheiro em vez de apenas abrir
 */
async function downloadImage(url, filename) {
    if (!url) { showKSAlert('Nenhuma imagem disponível.'); return; }

    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;

        // Tentar obter extensão original se possível
        const extension = url.split('.').pop().split('?')[0] || 'jpg';
        a.download = `${filename}.${extension}`;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
    } catch (e) {
        console.error('Erro no download:', e);
        // Fallback: abrir em nova aba
        window.open(url, '_blank');
    }
}

// ======== BUSCA ========

function initSearch() {
    const searchInput = document.getElementById('search-orders');
    if (!searchInput) return;

    // Busca ao digitar (local)
    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase().trim();
        const rows = document.querySelectorAll('.orders-table tbody tr');

        rows.forEach(row => {
            const rowText = row.textContent.toLowerCase();
            row.style.display = rowText.includes(query) ? '' : 'none';
        });
    });

    // Busca ao apertar Enter (Supabase - caso não esteja visível no cache dos últimos 5/10)
    searchInput.addEventListener('keypress', async function (e) {
        if (e.key === 'Enter') {
            const query = this.value.trim();
            if (query.length < 3) return;

            console.log('🔍 Buscando no Supabase por ID ou tamanho:', query);

            // Se estivermos na aba "Geral", mudar para "Vendas" para mostrar resultados completos
            const currentSectionTitle = document.getElementById('page-title').textContent;
            if (currentSectionTitle === 'Visão Geral') {
                switchSection('vendas', document.querySelector('[data-section=vendas]'));
            }

            const tbody = document.getElementById('all-orders-table-body');
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Buscando...</td></tr>';

            // Buscar por ID exato ou tamanho
            const { data, error } = await safeSupabaseCall('busca detalhada', async (sb) => {
                let queryBuilder = sb.from('orders').select('*');

                // Se começar com #, remover para bater com o ID no banco
                let cleanQuery = query.startsWith('#') ? query.substring(1) : query;

                return await queryBuilder
                    .or(`id.ilike.%${cleanQuery}%,tamanho.ilike.%${cleanQuery}%`)
                    .order('created_at', { ascending: false });
            });

            if (!error && data) {
                renderOrders(tbody, data);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession(); // Verificar se já está logado
    initSearch();
});

// ======== GALERIA ========

async function loadGallery() {
    const grid = document.getElementById('gallery-grid-admin');
    if (!grid) return;

    const { data, error } = await safeSupabaseCall('carregar galeria', async (sb) => {
        return await sb.from('gallery').select('*').order('created_at', { ascending: false });
    });

    if (error) {
        grid.innerHTML = '<p style="color:red; padding:20px;">Erro ao carregar galeria.</p>';
        return;
    }

    if (!data || data.length === 0) {
        grid.innerHTML = '<p style="color:#999; padding:40px; text-align:center; width:100%;">A galeria está vazia. Adicione fotos para aparecerem na Home.</p>';
        return;
    }

    grid.innerHTML = '';
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gallery-item-admin';
        div.innerHTML = `
            <img src="${item.url}" alt="Foto da Galeria">
            <div class="gallery-item-overlay">
                <button class="btn-delete-gallery" onclick="deleteGalleryImage('${item.id}', '${item.url}')">Excluir</button>
            </div>
        `;
        grid.appendChild(div);
    });
}

async function handleGalleryUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    // Mostrar feedback de carregamento no botão
    const btn = document.querySelector('[onclick*="gallery-upload-input"]');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    try {
        // 1. Upload para Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `gallery_${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('gallery-images')
            .upload(fileName, file);

        if (uploadError) {
            console.error('❌ Erro no Storage (Upload):', uploadError);
            showKSAlert('❌ Erro no Storage (Upload): ' + uploadError.message + '\n\nIsso geralmente significa que o Bucket "gallery-images" precisa de políticas de INSERT.');
            throw uploadError;
        }

        // 2. Obter URL pública
        const { data: { publicUrl } } = supabaseClient
            .storage
            .from('gallery-images')
            .getPublicUrl(fileName);

        // 3. Salvar na Tabela
        const { error: insertError } = await safeSupabaseCall('salvar na tabela gallery', async (sb) => {
            return await sb.from('gallery').insert([{ url: publicUrl }]);
        });

        if (insertError) {
            showKSAlert('❌ Erro na Tabela (Database): ' + insertError.message + '\n\nIsso significa que a tabela "gallery" precisa de políticas de INSERT ou RLS desativado.');
            throw insertError;
        }

        showKSAlert('✅ Foto adicionada à galeria com sucesso!');
        loadGallery();
    } catch (e) {
        console.error('Erro geral no upload da galeria:', e);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        input.value = ''; // Reset input
    }
}

async function deleteGalleryImage(id, url) {
    if (!await showKSConfirm('Tem certeza que deseja excluir esta foto da galeria?')) return;

    try {
        // 1. Extrair nome do arquivo da URL para deletar no storage
        const fileName = url.split('/').pop();

        // 2. Deletar do Storage
        if (supabaseClient) {
            const { error: storageError } = await supabaseClient
                .storage
                .from('gallery-images')
                .remove([fileName]);
            if (storageError) console.warn('Aviso: Erro ao remover do storage:', storageError);
        }

        // 3. Deletar da Tabela
        const { error: dbError } = await safeSupabaseCall('deletar da tabela gallery', async (sb) => {
            return await sb.from('gallery').delete().eq('id', id);
        });

        if (dbError) throw dbError;

        loadGallery();
    } catch (e) {
        console.error('Erro ao deletar da galeria:', e);
        showKSAlert('❌ Erro ao deletar: ' + e.message);
    }
}

/* ============================================================
   CHAT CRM LOGIC (ADMIN VIEW)
   ============================================================ */

let activeChatOrderId = null;
let adminPresenceChannel = null;
let adminTypingTimer = null;
let adminIsTyping = false;
let adminPollInterval = null;      // Polling de mensagens do chat ativo
let adminLastMsgTimestamp = null;  // Timestamp da última mensagem vista
let globalPollInterval = null;     // Polling global para badge
let lastGlobalMsgCheck = null;     // Timestamp do último check global

// Escuta Mutações Globais em Messages para Atualizar Badge/Inbox
function initGlobalChatListener() {
    if (!supabaseClient) return;

    // Inicializar timestamp global
    lastGlobalMsgCheck = new Date().toISOString();

    // Realtime: atualiza badge e inbox quando chega nova mensagem
    supabaseClient.channel('global-chat-badge')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
            const data = payload.new;

            if (data.sender_type === 'client') {
                const sectionVisible = document.getElementById('section-mensagens')?.style.display !== 'none';
                if (!sectionVisible || data.order_id !== activeChatOrderId) {
                    incrementChatBadge();
                }
            }
            // Se a aba de mensagens está visível, recarregar inbox
            const sectionVisible = document.getElementById('section-mensagens')?.style.display !== 'none';
            if (sectionVisible) loadChatInbox(false);

            // Se a mensagem pertence ao grupo do chat ativo
            if (activeChatOrderId && data.sender_type === 'client') {
                const currentPrefix = activeChatOrderId.split('-').slice(0, 2).join('-');
                if (data.order_id.startsWith(currentPrefix)) {
                    document.getElementById('admin-typing-indicator')?.remove();
                    if (!document.getElementById(data.id)) {
                        appendAdminMessageUI(data);
                        scrollAdminChatBottom();
                    }
                }
            }
        })
        .subscribe();

    // Polling global de fallback: verifica mensagens novas a cada 8s
    if (globalPollInterval) clearInterval(globalPollInterval);
    globalPollInterval = setInterval(async () => {
        try {
            const { data: newMsgs } = await supabaseClient
                .from('messages')
                .select('order_id, id, sender_type')
                .eq('sender_type', 'client')
                .gt('created_at', lastGlobalMsgCheck)
                .limit(20);

            if (newMsgs && newMsgs.length > 0) {
                lastGlobalMsgCheck = new Date().toISOString();

                const sectionVisible = document.getElementById('section-mensagens')?.style.display !== 'none';

                // Badge: incrementar por mensagens em pedidos que não estão abertos
                const outsideOrders = newMsgs.filter(m => m.order_id !== activeChatOrderId);
                if (outsideOrders.length > 0) {
                    outsideOrders.forEach(() => incrementChatBadge());
                }

                // Se a aba está aberta, atualizar inbox
                if (sectionVisible) loadChatInbox(false);

                // Se há mensagens para o chat ativo, adicionar sem duplicar
                const activeMsgs = newMsgs.filter(m => m.order_id === activeChatOrderId);
                if (activeMsgs.length > 0) startAdminChatPolling();
            }
        } catch (e) { /* silencioso */ }
    }, 8000);
}

function incrementChatBadge() {
    const badge = document.getElementById('chat-badge');
    badge.style.display = 'flex';
    let current = parseInt(badge.textContent || '0');
    badge.textContent = (current + 1).toString();
}

// Caso a aba mensagens seja aberta
document.querySelector('[data-section="mensagens"]').addEventListener('click', () => {
    const badge = document.getElementById('chat-badge');
    badge.style.display = 'none';
    badge.textContent = '0';
});

// 1. Carregar Lista (Lateral)
async function loadChatInbox(showLoading = true) {
    const listEl = document.getElementById('chat-inbox-list');
    if (!listEl) return;

    if (showLoading) listEl.innerHTML = '<p style="padding:20px; color:#999; text-align:center;">Carregando...</p>';

    try {
        // Ordena por last_message_at
        const { data: activeOrders, error } = await safeSupabaseCall('carregar chat inbox', async (sb) => {
            return await sb.from('orders')
                .select('id, client_name, client_phone, status, last_message_at, created_at')
                // Exibe apenas a galera que de fato preencheu algo ou iniciou conversa
                .not('client_name', 'is', 'null')
                .order('last_message_at', { ascending: false, nullsFirst: false })
                .limit(50);
        });

        if (error) throw error;

        if (!activeOrders || activeOrders.length === 0) {
            listEl.innerHTML = '<p style="padding:20px; color:#999; text-align:center;">Nenhum atendimento conversacional pendente.</p>';
            return;
        }

        // --- Agrupamento por ID de Grupo (Deduplicação) ---
        const uniqueGroups = new Map();
        activeOrders.forEach(ord => {
            const groupId = ord.id.split('-').slice(0, 2).join('-'); // Ex: 'KS-3692'
            // Como a query já vem ordenada por recência, a primeira vez que vemos o groupId é o pedido mais recente
            if (!uniqueGroups.has(groupId)) {
                uniqueGroups.set(groupId, ord);
            }
        });

        const deduplicatedOrders = Array.from(uniqueGroups.values());

        let html = '';
        deduplicatedOrders.forEach(ord => {
            const name = ord.client_name || 'Desconhecido';
            let timeStr = '';
            if (ord.last_message_at) {
                timeStr = new Date(ord.last_message_at).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
            } else {
                timeStr = new Date(ord.created_at).toLocaleDateString('pt-MZ');
            }

            const isActive = ord.id === activeChatOrderId ? 'active' : '';

            html += `
                <div class="inbox-item ${isActive}" onclick="openAdminChat('${ord.id}', '${name.replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${(ord.client_phone || '').replace(/'/g, "\\'")}')">
                    <div class="inbox-item-header">
                        <span class="inbox-order">#${ord.id}</span>
                        <span class="inbox-time">${timeStr}</span>
                    </div>
                    <div class="inbox-client-name">${name}</div>
                    <div class="inbox-preview">${ord.status} &bull; ${ord.client_phone || 'Sem número'}</div>
                </div>
            `;
        });

        listEl.innerHTML = html;

    } catch (err) {
        if (showLoading) listEl.innerHTML = '<p style="padding:20px; color:red; text-align:center;">Erro ao carregar conversas.</p>';
        console.error("Inbox load fail:", err);
    }
}

// 2. Abrir Conversa Direita
async function openAdminChat(orderId, clientName, clientPhone) {
    activeChatOrderId = orderId;
    loadChatInbox(false);

    // Desconectar canal de Presence anterior se existir
    if (adminPresenceChannel) {
        supabaseClient.removeChannel(adminPresenceChannel);
        adminPresenceChannel = null;
    }

    const mainView = document.getElementById('chat-mainview');
    mainView.innerHTML = `
        <div class="active-chat-header">
            <div class="active-chat-info">
                <h3>${clientName} (#${orderId})</h3>
                <p id="admin-client-status">📞 ${clientPhone || 'Não informado'}</p>
            </div>
            <div class="active-chat-actions">
                <button onclick="generateAndSendInvoice('${orderId}')">🧾 Gerar e Enviar Fatura PDF</button>
            </div>
        </div>
        
        <div class="admin-messages-area" id="admin-messages-area">
            <p style="text-align:center; color:#666; font-size:12px; margin-top:40px;">Buscando histórico...</p>
        </div>
        
        <div class="admin-chat-input-area">
            <button class="btn-attach" onclick="alert('Upload no chat chega na V2')" title="Anexar Arte">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </button>
            <input type="text" id="admin-message-input" placeholder="Mensagem padrão de alta fidelidade..." onkeydown="handleAdminChatKey(event)" oninput="onAdminTyping()">
            <button onclick="sendAdminMessage()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
        </div>
    `;

    await loadAdminChatHistory(orderId);
    startAdminChatPolling(orderId); // Iniciar polling de mensagens para este chat

    // Inicializar Presence para este chat (Usando Prefixo para agrupar múltiplos pedidos)
    const prefix = orderId.split('-').slice(0, 2).join('-');

    adminPresenceChannel = supabaseClient.channel(`presence_${prefix}`, {
        config: { presence: { key: 'admin' } }
    });

    adminPresenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = adminPresenceChannel.presenceState();
            console.log('Admin Presence State:', state);
            const clientOnline = state.client && state.client.length > 0;
            const statusEl = document.getElementById('admin-client-status');
            if (statusEl) {
                statusEl.textContent = clientOnline
                    ? `🟢 ${clientName} está online`
                    : `📞 ${clientPhone || 'Não informado'}`;
            }
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.payload?.role === 'client') {
                showClientTypingInAdmin(payload.payload?.isTyping);
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await adminPresenceChannel.track({ role: 'admin', order_id: prefix });
            }
        });
}

// 3. Carregar Array de Msgs daquele Order
async function loadAdminChatHistory(orderId) {
    const area = document.getElementById('admin-messages-area');
    if (!area) return;

    try {
        const prefix = orderId.split('-').slice(0, 2).join('-'); // Ex: 'KS-3692'
        const { data: msgs, error } = await safeSupabaseCall('carregar historico da conversa', async (sb) => {
            return await sb.from('messages')
                .select('*')
                .like('order_id', `${prefix}%`)
                .order('created_at', { ascending: true });
        });

        if (error) throw error;
        area.innerHTML = '';

        if (msgs.length === 0) {
            area.innerHTML = '<p style="text-align:center;color:#666; margin-top:20px;">Nenhuma mensagem registrada ainda.</p>';
        } else {
            msgs.forEach(msg => appendAdminMessageUI(msg));
            // Guardar timestamp da última mensagem para o polling
            adminLastMsgTimestamp = msgs[msgs.length - 1].created_at;
        }
        scrollAdminChatBottom();

    } catch (err) {
        area.innerHTML = '<p style="color:red; text-align:center;">Falha ao puxar chat logs.</p>';
    }
}

// Polling de mensagens do chat ativo: busca mensagens novas a cada 3s
function startAdminChatPolling(orderId) {
    if (!orderId) orderId = activeChatOrderId;
    if (!orderId) return;

    if (adminPollInterval) clearInterval(adminPollInterval);
    adminPollInterval = setInterval(async () => {
        const area = document.getElementById('admin-messages-area');
        if (!area || !adminLastMsgTimestamp) return;

        try {
            const prefix = activeChatOrderId.split('-').slice(0, 2).join('-');
            const { data: newMsgs } = await supabaseClient
                .from('messages')
                .select('*')
                .like('order_id', `${prefix}%`)
                .gt('created_at', adminLastMsgTimestamp)
                .order('created_at', { ascending: true });

            if (newMsgs && newMsgs.length > 0) {
                // Remover typing indicator se existia
                document.getElementById('admin-typing-indicator')?.remove();

                newMsgs.forEach(msg => {
                    if (document.getElementById(msg.id)) return; // já existe

                    // Remover mensagem temporária se for do admin e tiver o mesmo texto
                    if (msg.sender_type === 'admin') {
                        const text = msg.content?.text;
                        if (text) {
                            document.querySelectorAll('[id^="admin_t_"]').forEach(el => {
                                if (el.textContent.includes(text)) el.remove();
                            });
                        }
                    }

                    appendAdminMessageUI(msg);
                });
                adminLastMsgTimestamp = newMsgs[newMsgs.length - 1].created_at;
                scrollAdminChatBottom();
            }
        } catch (e) { /* silencioso */ }
    }, 3000);
}

// 4. Enviar Mensagem do Painel
async function sendAdminMessage() {
    if (!activeChatOrderId) return;
    const input = document.getElementById('admin-message-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = ''; // Limpa pra UX imediata

    const tempId = 'admin_t_' + Date.now();
    const tempMsg = {
        id: tempId,
        sender_type: 'admin',
        content_type: 'text',
        content: { text: text },
        created_at: new Date().toISOString()
    };

    appendAdminMessageUI(tempMsg);
    scrollAdminChatBottom();

    try {
        const { error } = await safeSupabaseCall('enviar mensagem do admin', async (sb) => {
            return await sb.from('messages').insert([{
                order_id: activeChatOrderId,
                sender_type: 'admin',
                content_type: 'text',
                content: { text: text }
            }]);
        });

        if (error) throw error;

        // Atualiza a Last Message no Order
        safeSupabaseCall('atualiza last message order', async (sb) => {
            return await sb.from('orders').update({ last_message_at: new Date().toISOString() }).eq('id', activeChatOrderId);
        });

        // Faz sidebar pular pra cima (silenciosamente)
        setTimeout(() => loadChatInbox(false), 500);

    } catch (err) {
        console.error("Falha ao responder:", err);
        showKSAlert("Erro: A mensagem pode não ter sido enviada.");
        input.value = text;
        document.getElementById(tempId)?.remove();
    }
}

function handleAdminChatKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendAdminMessage();
    }
}

// 5. Auxiliares UI
function appendAdminMessageUI(msg) {
    const area = document.getElementById('admin-messages-area');
    if (!area) return;

    if (msg.sender_type === 'system') {
        const d = document.createElement('div');
        d.className = 'admin-system-msg';
        d.id = msg.id;
        d.textContent = msg.content?.text || 'Notificação Sistema';
        area.appendChild(d);
        return;
    }

    const isClient = (msg.sender_type === 'client');
    const row = document.createElement('div');
    row.className = `admin-msg-row ${isClient ? 'client' : 'admin'}`;
    row.id = msg.id;

    const timeFmt = new Date(msg.created_at).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });

    let cHtml = '';

    if (msg.content_type === 'invoice') {
        const url = msg.content?.url || '#';
        cHtml = `
            <div style="background:#1a1a1a; border:1px solid rgba(212,184,150,0.3); border-radius:10px; padding:14px; text-align:center;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4b896" stroke-width="2" style="margin-bottom:8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <div style="font-weight:bold; color:#d4b896; margin-bottom:4px;">Fatura Oficial KSBOLD</div>
                <a href="${url}" target="_blank" style="display:inline-block; margin-top:8px; padding:6px 12px; background:#d4b896; color:#000; text-decoration:none; border-radius:4px; font-size:11px; font-weight:600;">Abrir PDF</a>
            </div>
        `;
    } else {
        cHtml = msg.content?.text?.replace(/\n/g, '<br>') || '';
    }

    // Cor das bolhas: cliente = azul escuro visível, admin = dourado
    const bubbleStyle = isClient
        ? 'background:#1e3a5f; color:#e8f4ff;'  // Azul para mensagens do cliente
        : 'background:#d4b896; color:#111;';     // Dourado para mensagens do admin

    row.innerHTML = `
        <div class="admin-msg-bubble" style="${bubbleStyle}">
            ${cHtml}
            <div style="font-size:9px; text-align:right; margin-top:4px; opacity:0.6;">${timeFmt}</div>
        </div>
    `;
    area.appendChild(row);
}

function showClientTypingInAdmin(typing) {
    const area = document.getElementById('admin-messages-area');
    if (!area) return;

    let indicator = document.getElementById('admin-typing-indicator');

    if (typing) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'admin-typing-indicator';
            indicator.className = 'admin-msg-row client';
            indicator.innerHTML = `
                <div class="admin-msg-bubble" style="background:#1e3a5f; color:#e8f4ff; font-style:italic; opacity:0.7;">
                    a escrever
                    <span style="display:inline-flex;gap:2px;margin-left:4px;">
                        <span style="animation:typingBounce 1.2s infinite">●</span>
                        <span style="animation:typingBounce 1.2s infinite 0.2s">●</span>
                        <span style="animation:typingBounce 1.2s infinite 0.4s">●</span>
                    </span>
                </div>
            `;
            area.appendChild(indicator);
            scrollAdminChatBottom();
        }
    } else {
        indicator?.remove();
    }
}

function onAdminTyping() {
    if (!adminPresenceChannel) return;

    if (!adminIsTyping) {
        adminIsTyping = true;
        adminPresenceChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { role: 'admin', isTyping: true }
        });
    }

    clearTimeout(adminTypingTimer);
    adminTypingTimer = setTimeout(() => {
        adminIsTyping = false;
        adminPresenceChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { role: 'admin', isTyping: false }
        });
    }, 1500);
}

function scrollAdminChatBottom() {
    const area = document.getElementById('admin-messages-area');
    if (area) area.scrollTop = area.scrollHeight;
}

// 6. GERADOR DE PDF REAL E INTEGRAÇÃO
async function generateAndSendInvoice(orderId) {
    if (!await showKSConfirm("Deseja gerar a Fatura KSBOLD Oficial agora e enviar no chat deste cliente?")) return;

    showKSAlert("Gerando fatura... aguarde.");

    try {
        // 1. Puxar Todos os Pedidos do mesmo Grupo (KS-XXXX)
        const groupPrefix = activeChatOrderId.split('-').slice(0, 2).join('-'); // Pega 'KS-1362' de 'KS-1362-1'

        const { data: allOrders, error: ordersErr } = await safeSupabaseCall('get all group orders', async sb => {
            return await sb.from('orders')
                .select('*')
                .like('id', `${groupPrefix}%`)
                .order('id', { ascending: true });
        });

        if (ordersErr || !allOrders || allOrders.length === 0) throw new Error("Não foi possível carregar os pedidos do grupo.");

        // Dados do cliente (usar do primeiro pedido)
        const primaryOrder = allOrders[0];

        // Setup jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Estilo e Cores da Marca KSBOLD
        const primaryColor = [10, 46, 46]; // #0a2e2e
        const goldColor = [212, 184, 150]; // #d4b896

        // Cabeçalho Premium
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(...goldColor);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("KSBOLD", 15, 25);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("A Arte Transformada em Quadros.", 15, 32);

        // Info Fatura
        doc.setTextColor(...primaryColor);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("FATURA OFICIAL", 15, 55);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`Fatura Nº: ${groupPrefix}`, 15, 65);
        doc.text(`Data: ${new Date().toLocaleDateString('pt-MZ')}`, 15, 70);

        // Info Cliente
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Cliente:", 120, 55);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Nome: ${primaryOrder.client_name || 'Consumidor Final'}`, 120, 62);
        doc.text(`Contato: ${primaryOrder.client_phone || 'Não inf.'}`, 120, 67);

        // Tabela Itens
        doc.setDrawColor(...goldColor);
        doc.setLineWidth(0.5);
        doc.line(15, 80, 195, 80);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Descrição do Item", 15, 88);
        doc.text("ID / Tamanho", 100, 88);
        doc.text("Valor", 175, 88);

        doc.line(15, 93, 195, 93);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);

        let yTable = 100;
        let totalGeral = 0;

        allOrders.forEach(order => {
            doc.text("Quadro Foam board", 15, yTable);
            const displaySize = order.size || order.tamanho || 'Tam. Padrão';
            doc.text(`${order.id} (${displaySize})`, 100, yTable);
            doc.text(`MT ${Number(order.price || order.preco || 0).toLocaleString('pt-MZ')}`, 175, yTable);

            totalGeral += Number(order.price || order.preco || 0);
            yTable += 10;

            // Se a tabela ficar muito longa, jsPDF precisaria de nova página (simplificado p/ agora)
        });

        // Totais e Detalhes
        doc.line(15, yTable, 195, yTable);
        yTable += 10;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text("TOTAL A PAGAR:", 120, yTable);
        doc.text(`MT ${totalGeral.toLocaleString('pt-MZ')}`, 170, yTable);

        yTable += 25;

        // Info Pagamentos (Atualizado)
        doc.setFillColor(245, 245, 245);
        doc.rect(15, yTable, 180, 35, 'F');
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text("DADOS PARA PAGAMENTO (E-MOLA / MKESH):", 20, yTable + 10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text("Titular: KELVIN EDILSON", 20, yTable + 18);
        doc.text("e-Mola: 869312874", 20, yTable + 24);
        doc.text("m-Kesh: 834355768", 20, yTable + 30);

        // Rodapé
        doc.setFontSize(8);
        doc.text("Nota: Comprovativos devem ser enviados diretamente neste Chat.", 105, 280, null, null, "center");

        // 2. Transforma o PDF em Blob
        const pdfBlob = doc.output('blob');

        // 3. Fazer Upload para o Supabase Storage (reaproveitando o bucket pub 'gallery-images')
        const filePath = `invoices/${activeChatOrderId}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabaseClient.storage
            .from('gallery-images')
            .upload(filePath, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // 4. Pegar URL Pública
        const { data: publicUrlData } = supabaseClient.storage.from('gallery-images').getPublicUrl(filePath);
        const finalUrl = publicUrlData.publicUrl;

        // 5. Inserir a Fatura no Histórico do Realtime
        await safeSupabaseCall('insert invoice chat msg', async sb => {
            return await sb.from('messages').insert([{
                order_id: activeChatOrderId,
                sender_type: 'admin',
                content_type: 'invoice',
                content: { url: finalUrl, text: "Sua fatura de compra atualizada." }
            }]);
        });

        showKSAlert("✅ Fatura Gerada e Enviada para a Timeline do Cliente.");
        loadAdminChatHistory(activeChatOrderId);

    } catch (err) {
        console.error("Erro Fatura:", err);
        showKSAlert("❌ Ocorreu um erro gerando o PDF: " + err.message);
    }
}

// ======== WHATSAPP BOT CONFIG ========

async function loadWhatsAppConfig() {
    const textarea = document.getElementById('whatsapp-template-input');
    if (!textarea) return;

    const { data, error } = await safeSupabaseCall('carregar template whatsapp', async (sb) => {
        return await sb.from('bot_settings').select('*').eq('key', 'whatsapp_template').single();
    });

    if (!error && data && data.value) {
        textarea.value = data.value;
    } else {
        // Template padrão se nada existir no banco
        textarea.value = `🎉 *Parabéns, {nome}!* 🎉\n\nRecebemos o seu pedido de quadros na *KSBOLD* com sucesso!\n\n📦 *Pedido:* #{order_id}\n🖼️ *Tamanho:* {tamanho}\n💰 *Valor:* MT {preco}\n\n━━━━━━━━━━━━━━━━━━━━━━\n💳 *DADOS PARA PAGAMENTO:*\n- *e-Mola:* 869312874\n- *m-Kesh:* 834355768\n━━━━━━━━━━━━━━━━━━━━━━\n\nPor favor, envie o comprovativo de pagamento aqui para iniciarmos a produção.`;
    }
}

async function saveWhatsAppTemplate() {
    const textarea = document.getElementById('whatsapp-template-input');
    if (!textarea) return;

    const template = textarea.value.trim();
    if (!template) {
        showKSAlert('A mensagem não pode estar vazia.');
        return;
    }

    const { error } = await safeSupabaseCall('salvar template whatsapp', async (sb) => {
        return await sb.from('bot_settings').upsert({ key: 'whatsapp_template', value: template }, { onConflict: 'key' });
    });

    if (!error) {
        showKSAlert('✅ Mensagem do WhatsApp atualizada com sucesso!\n\nO bot vai usar esta nova mensagem no próximo pedido.');
    } else {
        showKSAlert('❌ Erro ao salvar: ' + error.message + '\n\nCertifique-se de que a tabela "bot_settings" existe no Supabase.');
    }
}

async function showWhatsAppQR() {
    const btn = document.getElementById('btn-whatsapp-qr');
    btn.textContent = 'Carregando QR Code...';
    btn.disabled = true;

    try {
        // Buscar credenciais do banco de dados (não expor no frontend!)
        const { data: settings } = await safeSupabaseCall('buscar config evolution', async (sb) => {
            return await sb.from('bot_settings').select('key, value').in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance']);
        });

        const getVal = (key, fallback) => settings?.find(s => s.key === key)?.value || fallback;
        const apiUrl = getVal('evolution_api_url', '');
        const apiKey = getVal('evolution_api_key', '');
        const instance = getVal('evolution_instance', 'ksbold-loja');

        if (!apiUrl || !apiKey) {
            showKSAlert('⚠️ Configure a URL e a API Key da Evolution API nas configurações do Supabase (tabela bot_settings).\n\nChaves: evolution_api_url, evolution_api_key');
            btn.textContent = 'Gerar QR Code de Conexão WhatsApp';
            btn.disabled = false;
            return;
        }

        // Verificar status de conexão
        const statusRes = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
            headers: { 'apikey': apiKey }
        });
        const statusData = await statusRes.json();

        if (statusData?.instance?.state === 'open') {
            showKSAlert('✅ O WhatsApp já está conectado e ativo!\n\nNão precisa gerar novo QR Code.');
            btn.textContent = 'Gerar QR Code de Conexão WhatsApp';
            btn.disabled = false;
            return;
        }

        // Solicitar QR Code
        const qrRes = await fetch(`${apiUrl}/instance/connect/${instance}`, {
            headers: { 'apikey': apiKey }
        });
        const qrData = await qrRes.json();

        if (qrData?.base64) {
            const overlay = document.createElement('div');
            overlay.className = 'ks-modal-overlay';
            overlay.innerHTML = `
                <div class="ks-modal" style="max-width:400px;text-align:center;">
                    <div class="ks-modal-title">📱 Escaneie com o WhatsApp</div>
                    <div class="ks-modal-message" style="margin-bottom:15px;">
                        Abra o WhatsApp no celular → Menu (⋮) → Aparelhos Conectados → Conectar.
                    </div>
                    <img src="${qrData.base64}" style="width:280px; height:280px; border-radius:12px; border:2px solid #d4b896;" alt="QR Code WhatsApp">
                    <div class="ks-modal-actions" style="margin-top:15px;">
                        <button class="ks-modal-btn ks-modal-btn-primary" id="btn-close-qr">Fechar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('visible'), 10);

            document.getElementById('btn-close-qr').onclick = () => {
                overlay.classList.remove('visible');
                setTimeout(() => document.body.removeChild(overlay), 300);
            };
        } else {
            showKSAlert('⚠️ Não foi possível gerar o QR Code.\n\nVerifique se a Evolution API está online no Render.');
        }
    } catch (e) {
        console.error('Erro QR:', e);
        showKSAlert('❌ Falha ao conectar à Evolution API: ' + e.message);
    }

    btn.textContent = 'Gerar QR Code de Conexão WhatsApp';
    btn.disabled = false;
}

// ======== GERAR FATURA PDF DO PEDIDO ========

async function generateOrderPDF(orderId) {
    // Buscar dados do pedido
    const { data: order, error } = await safeSupabaseCall('buscar pedido para PDF', async (sb) => {
        return await sb.from('orders').select('*').eq('id', orderId).single();
    });

    if (error || !order) {
        showKSAlert('❌ Erro ao buscar dados do pedido.');
        return;
    }

    // Buscar outros itens do mesmo grupo
    const groupMatch = order.id.match(/(KS-\d+)-(\d+)/);
    let allItems = [order];
    let totalGeral = Number(order.preco || 0);

    if (groupMatch) {
        const groupId = groupMatch[1];
        const { data: groupItems } = await safeSupabaseCall('buscar grupo para PDF', async (sb) => {
            return await sb.from('orders').select('*').ilike('id', `${groupId}-%`);
        });

        if (groupItems && groupItems.length > 1) {
            allItems = groupItems;
            totalGeral = groupItems.reduce((sum, o) => sum + Number(o.preco || 0), 0);
        }
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const clientName = order.client_name || 'N/A';
        const clientPhone = order.client_phone || 'N/A';
        const date = new Date(order.created_at).toLocaleDateString('pt-MZ', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const groupId = groupMatch ? groupMatch[1] : order.id;

        // === HEADER ===
        doc.setFillColor(10, 10, 15);
        doc.rect(0, 0, 210, 45, 'F');

        doc.setTextColor(212, 184, 150);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text('KSBOLD', 20, 28);

        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('Fine Art Studio', 20, 36);

        doc.setFontSize(16);
        doc.setTextColor(212, 184, 150);
        doc.text('FATURA', 160, 28);

        // === INFO DO PEDIDO ===
        let y = 60;
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);

        doc.setFont('helvetica', 'bold');
        doc.text('FATURA PARA:', 20, y);
        doc.text('DETALHES:', 120, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(clientName, 20, y);
        doc.text(`Pedido: #${groupId}`, 120, y);
        y += 6;
        doc.text(`WhatsApp: ${clientPhone}`, 20, y);
        doc.text(`Data: ${date}`, 120, y);
        y += 6;
        doc.text(`Status: ${order.status || 'Pendente'}`, 120, y);

        // === TABELA DE ITENS ===
        y += 15;
        doc.setFillColor(212, 184, 150);
        doc.rect(20, y, 170, 10, 'F');

        doc.setTextColor(10, 10, 15);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('ITEM', 25, y + 7);
        doc.text('TAMANHO', 80, y + 7);
        doc.text('VALOR (MT)', 145, y + 7);

        y += 14;
        doc.setTextColor(40, 40, 40);
        doc.setFont('helvetica', 'normal');

        allItems.forEach((item, idx) => {
            if (idx % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(20, y - 4, 170, 9, 'F');
            }
            doc.text(`Quadro ${idx + 1} (#${item.id})`, 25, y + 2);
            doc.text(item.tamanho || 'N/A', 80, y + 2);
            doc.text(`MT ${Number(item.preco || 0).toFixed(2)}`, 145, y + 2);
            y += 10;
        });

        // === TOTAL ===
        y += 5;
        doc.setDrawColor(212, 184, 150);
        doc.line(20, y, 190, y);
        y += 10;

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(10, 10, 15);
        doc.text('TOTAL:', 120, y);
        doc.setTextColor(212, 184, 150);
        doc.text(`MT ${totalGeral.toFixed(2)}`, 150, y);

        // === DADOS DE PAGAMENTO ===
        y += 20;
        doc.setFillColor(240, 235, 228);
        doc.roundedRect(20, y, 170, 30, 3, 3, 'F');

        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.setFont('helvetica', 'bold');
        doc.text('DADOS PARA PAGAMENTO:', 25, y + 10);
        doc.setFont('helvetica', 'normal');
        doc.text('e-Mola: 869312874', 25, y + 18);
        doc.text('m-Kesh: 834355768', 25, y + 25);

        // === FOOTER ===
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('KSBOLD Fine Art Studio — Mozambique', 105, 280, { align: 'center' });
        doc.text('Obrigado pela sua compra!', 105, 285, { align: 'center' });

        // Salvar/Download
        doc.save(`Fatura_KSBOLD_${groupId}.pdf`);
        showKSAlert(`✅ Fatura gerada com sucesso!\n\nFicheiro: Fatura_KSBOLD_${groupId}.pdf`);

    } catch (err) {
        console.error('Erro PDF:', err);
        showKSAlert('❌ Erro ao gerar PDF: ' + err.message);
    }
}
// ======== TELEMETRIA: FUNIL AO VIVO & ANALYTICS ========

let funnelChannel = null;

/**
 * Inicializa o monitoramento em tempo real do funil
 */
function initFunnelPresence() {
    if (!supabaseClient) return;
    if (funnelChannel) return; // Já inicializado

    funnelChannel = supabaseClient.channel('ksbold-funnel');
    
    funnelChannel
        .on('presence', { event: 'sync' }, () => {
            renderLiveFunnel(funnelChannel.presenceState());
        })
        .subscribe();
}

/**
 * Renderiza as barras e contadores do funil ao vivo
 */
function renderLiveFunnel(state) {
    const totalOnlineEl = document.getElementById('telemetria-total-online');
    const listEl = document.getElementById('telemetria-sessoes-lista');
    
    const counts = [0, 0, 0, 0]; // [Step 0, 1, 2, 3]
    const activeSessions = [];

    Object.values(state).forEach(presences => {
        presences.forEach(p => {
            if (p.step !== undefined) {
                counts[p.step]++;
                activeSessions.push(p);
            }
        });
    });

    const total = activeSessions.length;
    if (totalOnlineEl) totalOnlineEl.textContent = `${total} Online Agora`;

    // Atualizar Barras de Progresso
    counts.forEach((count, i) => {
        const bar = document.getElementById(`funnel-bar-${i}`);
        const countTxt = document.getElementById(`funnel-count-${i}`);
        
        if (bar) {
            // Lógica de largura: % relativa ao total de online
            const pct = total > 0 ? (count / total) * 100 : 0;
            bar.style.width = pct + '%';
            if (count > 0) bar.classList.add('funnel-glow');
            else bar.classList.remove('funnel-glow');
        }
        if (countTxt) countTxt.textContent = count;
    });

    // Atualizar Lista de Sessões
    if (listEl) {
        if (activeSessions.length === 0) {
            listEl.innerHTML = '<p style="color:#999; text-align:center; padding:15px;">Aguardando visitantes...</p>';
            return;
        }

        const stepNames = ['Início', 'Tamanhos', 'Upload', 'Checkout'];
        listEl.innerHTML = activeSessions.map(s => `
            <div class="sessao-item etapa-${s.step}">
                <div class="sessao-dot"></div>
                <strong style="width: 80px;">Sessão #${s.id.slice(-4)}</strong>
                <span>Etapa: <b>${stepNames[s.step]}</b></span>
                <small style="margin-left: auto; opacity: 0.6;">v.${s.v || '1.0'}</small>
            </div>
        `).join('');
    }
}

/**
 * Carrega dados históricos de desistência
 */
async function loadDesistenciaData(periodo) {
    // UI Feedback
    document.querySelectorAll('.btn-periodo').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-periodo="${periodo}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (!supabaseClient) return;

    try {
        let query = supabaseClient.from('telemetria_eventos').select('*');
        
        const agora = new Date();
        if (periodo === 'hoje') {
            agora.setHours(0, 0, 0, 0);
            query = query.gte('created_at', agora.toISOString());
        } else if (periodo === 'semana') {
            const semana = new Date();
            semana.setDate(semana.getDate() - 7);
            query = query.gte('created_at', semana.toISOString());
        } else if (periodo === 'mes') {
            const mes = new Date();
            mes.setMonth(mes.getMonth() - 1);
            query = query.gte('created_at', mes.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        processAndRenderChart(data);
    } catch (e) {
        console.error('Erro ao carregar telemetria:', e);
    }
}

/**
 * Processa os logs e calcula as taxas de desistência
 */
function processAndRenderChart(logs) {
    const totalByStep = [0, 0, 0, 0];
    
    // Contar quantas pessoas ÚNICAS passaram por cada etapa
    const sessionsByStep = [new Set(), new Set(), new Set(), new Set()];
    
    logs.forEach(log => {
        if (log.etapa_index !== undefined) {
            sessionsByStep[log.etapa_index].add(log.sessao_id);
        }
    });

    const uniqueCounts = sessionsByStep.map(s => s.size);
    const max = Math.max(...uniqueCounts, 1);

    uniqueCounts.forEach((count, i) => {
        const bar = document.getElementById(`desist-bar-${i}`);
        const pctTxt = document.getElementById(`desist-pct-${i}`);
        const numTxt = document.getElementById(`desist-num-${i}`);

        if (bar) {
            const height = (count / max) * 100;
            bar.style.height = height + '%';
        }

        // Taxa de Desistência: Pessoas que entraram nesta mas NÃO na próxima
        let desistencia = 0;
        if (i < 3) {
            const entrouNesta = uniqueCounts[i];
            const entrouProxima = uniqueCounts[i+1];
            if (entrouNesta > 0) {
                desistencia = Math.max(0, ((entrouNesta - entrouProxima) / entrouNesta) * 100);
            }
        } else {
            // Na última etapa, desistência é quem chegou mas não comprou (difícil medir sem webhook de pago)
            desistencia = 0; 
        }

        if (pctTxt) pctTxt.textContent = i < 3 ? desistencia.toFixed(0) + '%' : '-';
        if (numTxt) numTxt.textContent = count + ' sessões';
    });
}
