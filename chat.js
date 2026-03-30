/* ============================================================
   KSBOLD — Chat App Script (Cliente)
   ============================================================ */

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.KSBOLD_CONFIG || {};

const supabaseClient = (window.supabase && SUPABASE_URL)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Extrair order_id da URL (ex: ?order_id=KS-2086)
const urlParams = new URLSearchParams(window.location.search);
const currentOrderId = urlParams.get('order_id');

// ID real do pedido encontrado no Supabase (ex: KS-2086-1), necessário para FK de mensagens
let realOrderId = null;
let presenceChannel = null;
let typingTimer = null;
let isTyping = false;
let lastMessageTimestamp = null; // Para o polling inteligente
let pollInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!currentOrderId) {
        console.warn('Nenhum pedido na URL. Redirecionando...');
        window.location.replace('/');
        return;
    }
    document.getElementById('header-order-id').textContent = `#${currentOrderId}`;
    await checkOrderOnboarding();
});

/* =======================================
   1. ONBOARDING (NOME E CELULAR)
   ======================================= */
async function checkOrderOnboarding() {
    try {
        // O script.js guarda pedidos como KS-2086-1, KS-2086-2 (um por quadro).
        // Usar LIKE para encontrar o primeiro pedido do grupo.
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('id, client_name, client_phone')
            .like('id', `${currentOrderId}-%`)
            .order('id', { ascending: true })
            .limit(1);

        if (error) throw error;

        if (!orders || orders.length === 0) {
            alert('Pedido não encontrado. Verifica o link ou tenta novamente.');
            return;
        }

        realOrderId = orders[0].id;
        const order = orders[0];

        if (!order.client_name && !order.client_phone) {
            showOnboarding();
        } else {
            hideOnboarding();
            await startChatService();
        }
    } catch (e) {
        console.error('Erro ao checar onboarding:', e);
        alert('Erro ao verificar pedido: ' + (e.message || JSON.stringify(e)));
    }
}

function showOnboarding() {
    document.getElementById('onboarding-overlay').style.display = 'flex';
    document.getElementById('chat-input-area').style.display = 'none';
}

function hideOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        document.getElementById('chat-input-area').style.display = 'flex';
    }, 500);
}

async function submitOnboarding(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-onboarding-submit');
    const nameVal = document.getElementById('client-name').value.trim();
    const phoneVal = document.getElementById('client-phone').value.trim();
    if (!nameVal || !phoneVal) return;

    btn.textContent = 'Validando...';
    btn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({ client_name: nameVal, client_phone: phoneVal })
            .like('id', `${currentOrderId}-%`);

        if (error) throw error;

        // Mensagem de boas-vindas do sistema
        await supabaseClient.from('messages').insert([{
            order_id: realOrderId,
            sender_type: 'system',
            content_type: 'text',
            content: { text: `Obrigado, ${nameVal}! Estamos a preparar os detalhes do seu pedido. Um membro da nossa equipa estará consigo dentro de momentos.` }
        }]);

        hideOnboarding();
        await startChatService();

    } catch (err) {
        console.error('Erro ao salvar cliente:', err);
        alert('Problema de conexão. Tente novamente.');
        btn.textContent = 'Acessar Meu Pedido';
        btn.disabled = false;
    }
}

/* =======================================
   2. SERVIÇO DE CHAT (MENSAGENS + PRESENCE)
   ======================================= */
async function startChatService() {
    await loadMessageHistory();
    subscribeToMessages();
    startPolling();          // Fallback polling para garantir mensagens mesmo sem Realtime
    initPresence();
}

async function loadMessageHistory() {
    const container = document.getElementById('chat-messages-container');
    try {
        const { data: msgs, error } = await supabaseClient
            .from('messages')
            .select('*')
            .eq('order_id', realOrderId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        container.innerHTML = '';

        if (msgs.length === 0) {
            container.innerHTML = '<div class="system-message">O chat KSBOLD é monitorado. Ninguém pode ver suas fotos além da nossa equipa.</div>';
        } else {
            msgs.forEach(msg => appendMessageUI(msg));
            // Guardar timestamp da última mensagem para o polling
            lastMessageTimestamp = msgs[msgs.length - 1].created_at;
        }
        scrollToBottom();
    } catch (e) {
        container.innerHTML = '<div class="system-message" style="color:red;">Erro ao carregar mensagens. Recarregue a página.</div>';
    }
}

// Polling inteligente: busca apenas mensagens novas a cada 3 segundos
async function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        if (!currentOrderId) return;
        try {
            const query = supabaseClient
                .from('messages')
                .select('*')
                .like('order_id', `${currentOrderId}%`)
                .order('created_at', { ascending: true });

            if (lastMessageTimestamp) {
                query.gt('created_at', lastMessageTimestamp);
            }

            const { data: newMsgs } = await query;

            if (newMsgs && newMsgs.length > 0) {
                newMsgs.forEach(msg => {
                    // Se já existe no DOM com o ID real, ignorar
                    if (document.getElementById(msg.id)) return;

                    // Se é mensagem do cliente, remover qualquer temp com o mesmo texto (deduplicar)
                    if (msg.sender_type === 'client') {
                        const text = msg.content?.text;
                        if (text) {
                            document.querySelectorAll('[id^="temp-"]').forEach(el => {
                                if (el.textContent.includes(text)) el.remove();
                            });
                        }
                    }

                    appendMessageUI(msg);
                });
                lastMessageTimestamp = newMsgs[newMsgs.length - 1].created_at;
                scrollToBottom();
            }
        } catch (e) {
            // Silencioso — não interromper o utilizador por erros de polling
        }
    }, 3000);
}

function subscribeToMessages() {
    // Canal de mensagens — Realtime via postgres_changes
    const msgChannel = supabaseClient.channel(`messages_${currentOrderId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                // Filtro por prefixo via like não é suportado nativamente no filter do JS, 
                // então filtramos manualmente no callback ou usamos o polling como garantia.
                // Vou remover o filter aqui e filtrar no código.
            },
            (payload) => {
                const newMsg = payload.new;
                if (!newMsg.order_id.startsWith(currentOrderId)) return;
                // Só adicionar mensagens do admin/sistema — as do cliente já aparecem via optimistic UI
                if (newMsg.sender_type !== 'client') {
                    appendMessageUI(newMsg);
                    scrollToBottom();
                }
            }
        )
        .subscribe((status) => {
            console.log('🟢 Canal de mensagens:', status);
        });
}

/* =======================================
   3. PRESENCE — ONLINE/OFFLINE + TYPING
   ======================================= */
function initPresence() {
    presenceChannel = supabaseClient.channel(`presence_${currentOrderId}`, {
        config: { presence: { key: 'client' } }
    });

    // Escutar estado do admin
    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            console.log('Client Presence State:', state);
            const adminOnline = state.admin && state.admin.length > 0;
            updateAdminStatus(adminOnline, false);
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.payload?.role === 'admin') {
                showAdminTyping(payload.payload?.isTyping);
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // Anunciar presença do cliente
                await presenceChannel.track({ role: 'client', order_id: currentOrderId });
            }
        });
}

function updateAdminStatus(online, typing) {
    const dot = document.getElementById('status-dot');
    const label = document.getElementById('status-label');
    if (!dot || !label) return;

    if (typing) {
        dot.className = 'status-dot online';
        label.textContent = 'KSBOLD está a escrever...';
    } else if (online) {
        dot.className = 'status-dot online';
        label.innerHTML = `Online • Pedido <span id="header-order-id">#${currentOrderId}</span>`;
    } else {
        dot.className = 'status-dot offline';
        label.innerHTML = `Pedido <span id="header-order-id">#${currentOrderId}</span>`;
    }
}

function showAdminTyping(typing) {
    updateAdminStatus(true, typing);
}

// Detetar quando o cliente está a escrever e broadcast para o admin
function onClientTyping() {
    if (!presenceChannel) return;

    if (!isTyping) {
        isTyping = true;
        presenceChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { role: 'client', isTyping: true }
        });
    }

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        isTyping = false;
        presenceChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { role: 'client', isTyping: false }
        });
    }, 1500);
}

/* =======================================
   4. ENVIO DE MENSAGENS PELO CLIENTE
   ======================================= */
async function sendMessage() {
    const input = document.getElementById('message-input');
    const textDesc = input.value.trim();
    if (!textDesc) return;

    input.value = '';
    input.style.height = 'auto';

    // Optimistic UI — mostrar imediatamente
    const tempId = 'temp-' + Date.now();
    appendMessageUI({
        id: tempId,
        sender_type: 'client',
        content_type: 'text',
        content: { text: textDesc },
        created_at: new Date().toISOString()
    });
    scrollToBottom();

    try {
        const { error } = await supabaseClient.from('messages').insert([{
            order_id: realOrderId,
            sender_type: 'client',
            content_type: 'text',
            content: { text: textDesc }
        }]);

        if (error) throw error;

        // Atualiza last_message_at para o admin ver a conversa no topo
        supabaseClient.from('orders').update({
            last_message_at: new Date().toISOString()
        }).like('id', `${currentOrderId}-%`);

    } catch (err) {
        console.error('Falha ao enviar:', err);
        const tempEl = document.getElementById(tempId);
        if (tempEl) tempEl.remove();
        input.value = textDesc;
        alert('A mensagem não foi enviada. Verifica a tua ligação.');
    }
}

/* =======================================
   5. MANIPULAÇÃO DO DOM
   ======================================= */
function appendMessageUI(msgObj) {
    const container = document.getElementById('chat-messages-container');
    const msgId = msgObj.id;

    // Mensagem de sistema
    if (msgObj.sender_type === 'system') {
        const sysDiv = document.createElement('div');
        sysDiv.className = 'system-message';
        sysDiv.id = msgId;
        sysDiv.textContent = msgObj.content?.text || 'Notificação';
        container.appendChild(sysDiv);
        return;
    }

    const isClient = (msgObj.sender_type === 'client');
    const rowDiv = document.createElement('div');
    rowDiv.className = `msg-row ${isClient ? 'client' : 'admin'}`;
    rowDiv.id = msgId;

    const timeFmt = new Date(msgObj.created_at).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });

    let contentHtml = '';

    if (msgObj.content_type === 'text') {
        contentHtml = msgObj.content?.text?.replace(/\n/g, '<br>') || '';
        rowDiv.innerHTML = `
            <div class="msg-bubble">
                ${contentHtml}
                <span class="msg-time">${timeFmt}</span>
            </div>
        `;
    } else if (msgObj.content_type === 'invoice') {
        // Bolha de fatura — aparece como card especial
        const url = msgObj.content?.url || '#';
        rowDiv.innerHTML = `
            <div class="msg-bubble" style="background:transparent; padding:0;">
                <div class="invoice-bubble">
                    <div class="invoice-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                    </div>
                    <div class="invoice-label">Fatura Oficial KSBOLD</div>
                    <div class="invoice-sub">Documento gerado para o teu pedido</div>
                    <a href="${url}" target="_blank">Abrir PDF</a>
                    <span class="msg-time" style="display:block; margin-top:8px;">${timeFmt}</span>
                </div>
            </div>
        `;
    } else if (msgObj.content_type === 'image') {
        rowDiv.innerHTML = `
            <div class="msg-bubble">
                <img src="${msgObj.content?.url}" style="max-width:100%; border-radius:8px;" alt="Anexo">
                <span class="msg-time">${timeFmt}</span>
            </div>
        `;
    }

    container.appendChild(rowDiv);
}

function scrollToBottom() {
    const c = document.getElementById('chat-messages-container');
    c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
}

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
}

// Enter para enviar (Shift+Enter = quebra de linha)
document.getElementById('message-input')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Typing indicator — detetar quando o cliente está a escrever
document.getElementById('message-input')?.addEventListener('input', function () {
    onClientTyping();
});

/* =======================================
   6. MODAL: ADICIONAR NOVO QUADRO
   ======================================= */
let newFrameFile = null;

async function openAddFrameModal() {
    document.getElementById('add-frame-modal').style.display = 'flex';
    await loadNewFrameSizes();
}

function closeAddFrameModal() {
    document.getElementById('add-frame-modal').style.display = 'none';
    resetNewFrameForm();
}

function resetNewFrameForm() {
    newFrameFile = null;
    document.getElementById('new-frame-file').value = '';
    document.getElementById('new-frame-preview-container').style.display = 'none';
    document.getElementById('upload-placeholder-content').style.display = 'block';
    document.getElementById('btn-confirm-new-frame').textContent = 'Confirmar e Adicionar';
    document.getElementById('btn-confirm-new-frame').disabled = false;
}

async function loadNewFrameSizes() {
    const select = document.getElementById('new-frame-size');
    if (!select) return;

    let prices = [
        { tamanho: 'A0', preco: 600 },
        { tamanho: 'A1', preco: 380 },
        { tamanho: 'A2', preco: 250 },
        { tamanho: 'A3', preco: 180 },
        { tamanho: 'A4', preco: 120 },
        { tamanho: 'A5', preco: 80 }
    ];

    try {
        const { data } = await supabaseClient.from('prices').select('tamanho, preco').order('tamanho');
        if (data && data.length > 0) prices = data;
    } catch (e) { console.warn('Usando preços padrão'); }

    select.innerHTML = prices.map(p => `<option value="${p.tamanho}" data-price="${p.preco}">${p.tamanho} - MT ${p.preco.toLocaleString()}</option>`).join('');
}

function handleNewFrameFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
        alert('Foto muito grande (máx 20MB).');
        return;
    }

    newFrameFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById('new-frame-preview').src = ev.target.result;
        document.getElementById('new-frame-preview-container').style.display = 'block';
        document.getElementById('upload-placeholder-content').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

async function confirmNewFrame() {
    const select = document.getElementById('new-frame-size');
    const size = select.value;
    const price = parseFloat(select.options[select.selectedIndex].dataset.price);
    const btn = document.getElementById('btn-confirm-new-frame');

    if (!newFrameFile) {
        alert('Por favor, envie uma foto para este novo quadro.');
        return;
    }

    btn.textContent = 'Processando...';
    btn.disabled = true;

    try {
        // 1. Descobrir ID do grupo e próximo sufixo
        const { data: siblingOrders } = await supabaseClient
            .from('orders')
            .select('id, client_name, client_phone')
            .like('id', `${currentOrderId}-%`)
            .order('id', { ascending: false });

        const nextSuffix = (siblingOrders?.length || 0) + 1;
        const newOrderId = `${currentOrderId}-${nextSuffix}`;
        const clientName = siblingOrders?.[0]?.client_name || '';
        const clientPhone = siblingOrders?.[0]?.client_phone || '';

        // 2. Upload da Foto
        const fileExt = newFrameFile.name.split('.').pop();
        const fileName = `order_${newOrderId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('order-images').upload(fileName, newFrameFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage.from('order-images').getPublicUrl(fileName);
        const imageUrl = urlData.publicUrl;

        // 3. Criar Pedido
        await supabaseClient.from('orders').insert([{
            id: newOrderId,
            tamanho: size,
            preco: price,
            imagem_url: imageUrl,
            client_name: clientName,
            client_phone: clientPhone,
            status: 'Pendente'
        }]);

        // 4. Mandar mensagem avisando
        await supabaseClient.from('messages').insert([{
            order_id: realOrderId,
            sender_type: 'system',
            content_type: 'text',
            content: { text: `🛒 NOVO QUADRO ADICIONADO: Tamanho ${size}. Já pode continuar o atendimento.` }
        }]);

        closeAddFrameModal();
        // O polling vai carregar a mensagem de sistema acima automaticamente
    } catch (e) {
        console.error(e);
        alert('Erro ao adicionar quadro: ' + e.message);
        btn.textContent = 'Confirmar e Adicionar';
        btn.disabled = false;
    }
}
