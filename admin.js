/* ============================================================
   KSBOLD — Script do Painel Admin
   ============================================================ */

// ======== CONFIGURAÇÃO SUPABASE ========
const SUPABASE_URL = 'https://zqsxmzbshsozggcwvxla.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxc3htemJzaHNvemdnY3d2eGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzMwODUsImV4cCI6MjA4NzU0OTA4NX0.Neo-VHUaq7Zwk211QLdg-GEMKgyrouJfl7QepTJZCvk';

let supabaseClient = null;

// Inicializar Supabase com verificação
try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client criado com sucesso');
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
    loadDashboardData();
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
        config: 'Configurações'
    };
    document.getElementById('page-title').textContent = titles[sectionId] || 'Visão Geral';

    document.getElementById('sidebar').classList.remove('open');

    if (sectionId === 'vendas') loadAllOrders();
    if (sectionId === 'config') loadConfigData();
    if (sectionId === 'galeria') loadGallery();

    if (event) event.preventDefault();
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
    console.log('📊 Dashboard carregado.');
}

async function loadStats() {
    const ordersEl = document.getElementById('stat-orders');
    const revenueEl = document.getElementById('stat-revenue');
    const usersEl = document.getElementById('stat-users');

    ordersEl.textContent = '0';
    revenueEl.textContent = 'MT 0,00';
    usersEl.textContent = '—';

    const { data: ordersData, error } = await safeSupabaseCall('carregar pedidos (stats)', async (sb) => {
        return await sb.from('orders').select('id, preco');
    });

    if (!error && ordersData) {
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
    }

    // Carregar contagem de visitas (Active Users)
    const { count: visitsCount, error: visitsError } = await safeSupabaseCall('carregar visitas', async (sb) => {
        return await sb.from('visits').select('*', { count: 'exact', head: true });
    });

    if (!visitsError) {
        usersEl.textContent = (visitsCount || 0).toString();
    } else {
        usersEl.textContent = '0';
    }
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
    const pixelAtivo = document.getElementById('config-pixel-toggle').checked;

    const { error } = await safeSupabaseCall('salvar pixel (config)', async (sb) => {
        return await sb.from('settings').upsert({ id: 1, meta_pixel_id: pixelId, pixel_ativo: pixelAtivo });
    });

    if (!error) {
        document.getElementById('pixel-id-input').value = pixelId;
        document.getElementById('pixel-toggle').checked = pixelAtivo;
        showKSAlert('✅ Configurações de Pixel e Sistema salvas com sucesso!');
    } else {
        showKSAlert('❌ Erro ao salvar: ' + error.message);
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">Nenhum pedido encontrado.</td></tr>';
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
      <td>
        <span class="order-id">#${order.id}</span>
        ${groupId ? `<br><small style="color:#999;font-size:10px;">Grupo: ${groupId}</small>` : ''}
      </td>
      <td>MT ${Number(order.preco || 0).toFixed(2)}</td>
      <td>
        <span class="status-badge ${statusClass}">${order.tamanho}</span>
        <div style="font-size:11px; margin-top:4px; color:#666;">${qtdInfo}</div>
      </td>
      <td>${date}</td>
      <td>
        <select class="status-select" onclick="event.stopPropagation()" onchange="updateOrderStatus('${order.id}', this.value)">
          <option value="Pendente" ${displayStatus === 'Pendente' ? 'selected' : ''}>Pendente</option>
          <option value="Completo" ${displayStatus === 'Completo' ? 'selected' : ''}>Completo</option>
          <option value="Cancelado" ${displayStatus === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
      </td>
      <td>
        <div class="action-buttons" onclick="event.stopPropagation()">
          <button class="action-btn view" title="Ver imagem" onclick="viewOrderImage('${order.imagem_url || ''}')">👁</button>
          <button class="action-btn download" title="Download" onclick="downloadImage('${order.imagem_url || ''}', 'pedido_${order.id}')">⬇</button>
          <button class="action-btn delete" title="Eliminar pedido" onclick="deleteOrder('${order.id}')">🗑️</button>
        </div>
      </td>
    `;
        tbody.appendChild(tr);
    });
}

async function updateOrderStatus(orderId, newStatus) {
    const { error } = await safeSupabaseCall('atualizar status', async (sb) => {
        return await sb.from('orders').update({ status: newStatus }).eq('id', orderId);
    });

    if (error) {
        showKSAlert('❌ Erro ao atualizar: ' + error.message);
    } else {
        // Atualizar no cache local e recarregar stats
        const order = allOrdersData.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        loadStats();
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
        loadStats();
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

    container.innerHTML = `
        <div class="detail-image-container">
            ${order.imagem_url
            ? `<img src="${order.imagem_url}" alt="Foto do pedido" onclick="viewOrderImage('${order.imagem_url}')" style="cursor:zoom-in">`
            : '<div class="no-image">Nenhuma imagem carregada para este pedido.</div>'}
        </div>

        ${otherItemsHtml}

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
