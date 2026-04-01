/* ============================================================
   KSBOLD — Script Principal (Cliente)
   ============================================================ */

// ======== CONFIGURAÇÃO SUPABASE ========
const { SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_NUMBER } = window.KSBOLD_CONFIG || {};

const supabaseClient = (window.supabase && SUPABASE_URL)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// ======== ESTADO DA APLICAÇÃO ========
let currentStep = 0;
let selectedSize = null;
let selectedPrice = null;
let uploadedFile = null;
let uploadedImageUrl = null;
let currentSlide = 0;
let carouselInterval = null;
let carrinho = []; // [ {tamanho, preco, file, previewUrl} ]
let mapaPrecosGlobal = {}; // { 'A4': 120, ... }

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


// ======== NAVEGAÇÃO ENTRE ETAPAS ========

/**
 * Navega para uma etapa específica (0-3)
 * @param {number} stepIndex - Índice da etapa destino
 */
function goToStep(stepIndex) {
    if (stepIndex < 0 || stepIndex > 3) return;

    const wrapper = document.getElementById('app-wrapper');
    const steps = document.querySelectorAll('.step');

    // Remover classe active de todas
    steps.forEach(s => s.classList.remove('active'));

    // Aplicar transformação vertical
    wrapper.style.transform = `translateY(-${stepIndex * 100}vh)`;

    // Activar nova etapa com pequeno delay para a animação funcionar
    setTimeout(() => {
        steps[stepIndex].classList.add('active');
    }, 100);

    currentStep = stepIndex;

    // Disparar eventos do Meta Pixel
    firePixelEvent(stepIndex);
}

/**
 * Dispara eventos do Meta Pixel conforme a etapa
 */
function firePixelEvent(stepIndex) {
    if (typeof fbq !== 'function') return;

    switch (stepIndex) {
        case 0:
            fbq('track', 'PageView');
            break;
        case 1:
            fbq('track', 'ViewContent', { content_name: 'Tamanhos' });
            break;
        case 2:
            // AddToCart é disparado na seleção de tamanho
            break;
        case 3:
            fbq('track', 'InitiateCheckout', {
                content_name: selectedSize,
                value: selectedPrice,
                currency: 'MZN'
            });
            break;
    }
}

// ======== CARROSSEL DE GALERIA ========

/**
 * Carrega imagens da tabela 'gallery' para a home
 */
async function loadGalleryImages() {
    const track = document.getElementById('carousel-track');
    if (!track) return;

    if (!supabaseClient) {
        track.innerHTML = '<div class="carousel-placeholder">Supabase não configurado.</div>';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('gallery')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            track.innerHTML = '<div class="carousel-placeholder">Transformando memórias em arte.</div>';
            return;
        }

        renderCarousel(data);
    } catch (e) {
        console.error('Erro ao carregar galeria:', e);
        track.innerHTML = '<div class="carousel-placeholder">Bem-vindo à KSBOLD.</div>';
    }
}

/**
 * Renderiza os itens do carrossel e inicializa a lógica
 */
function renderCarousel(images) {
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');

    if (!track || !dotsContainer) return;

    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    let firstImageLoaded = false;

    images.forEach((img, idx) => {
        // Slide com Skeleton
        const item = document.createElement('div');
        item.className = 'carousel-item skeleton-bg';
        
        // Estrategia de Prioridade (Primeira imagem eh eager e high priority)
        const loadingAttr = idx === 0 ? '' : 'loading="lazy"';
        const priorityAttr = idx === 0 ? 'fetchpriority="high"' : '';
        
        const imgElement = document.createElement('img');
        imgElement.src = img.url;
        imgElement.alt = `Galeria KSBOLD ${idx + 1}`;
        if (idx !== 0) imgElement.setAttribute('loading', 'lazy');
        if (idx === 0) imgElement.setAttribute('fetchpriority', 'high');
        
        // Listener de OnLoad
        imgElement.onload = () => {
            imgElement.classList.add('loaded');
            item.classList.remove('skeleton-bg');
            
            // So inicializar o timer quando a foto 1 baixar
            if (idx === 0 && !firstImageLoaded) {
                firstImageLoaded = true;
                startCarouselTimer(images.length);
            }
        };

        item.appendChild(imgElement);
        track.appendChild(item);

        // Dot
        const dot = document.createElement('div');
        dot.className = `dot ${idx === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
            goToSlide(idx, images.length);
            if (firstImageLoaded) resetCarouselTimer(images.length);
        });
        dotsContainer.appendChild(dot);
    });
}

function goToSlide(idx, total) {
    const track = document.getElementById('carousel-track');
    const dots = document.querySelectorAll('.dot');

    if (!track) return;

    currentSlide = idx;
    track.style.transform = `translateX(-${idx * 100}%)`;

    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === idx);
    });
}

function startCarouselTimer(total) {
    if (total <= 1) return;
    carouselInterval = setInterval(() => {
        let next = (currentSlide + 1) % total;
        goToSlide(next, total);
    }, 5000);
}

function resetCarouselTimer(total) {
    clearInterval(carouselInterval);
    startCarouselTimer(total);
}


// ======== CARREGAR PREÇOS DO SUPABASE ========

async function loadPrices() {
    const grid = document.getElementById('size-grid');
    if (!grid) return;

    // Preços padrão (fallback se Supabase não estiver configurado)
    let pricesArr = [
        { tamanho: 'A0', preco: 600.00 },
        { tamanho: 'A1', preco: 380.00 },
        { tamanho: 'A2', preco: 250.00 },
        { tamanho: 'A3', preco: 180.00 },
        { tamanho: 'A4', preco: 120.00 },
        { tamanho: 'A5', preco: 80.00 }
    ];

    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('prices')
                .select('tamanho, preco')
                .order('tamanho');

            if (!error && data && data.length > 0) {
                pricesArr = data;
            }
        } catch (e) {
            console.warn('Usando preços padrão.', e);
        }
    }

    grid.innerHTML = '';
    mapaPrecosGlobal = {};
    pricesArr.forEach(item => {
        mapaPrecosGlobal[item.tamanho] = item.preco;
        const card = document.createElement('div');
        card.className = 'size-card';
        card.innerHTML = `
            <div class="size-card-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 16l5-5 4 4 4-6 5 7"/></svg></div>
            <div class="size-name">${item.tamanho}</div>
            <div class="size-price">MT ${formatPrice(item.preco)}</div>
        `;
        card.onclick = () => selectSize(item.tamanho, item.preco, card);
        grid.appendChild(card);
    });
}

/**
 * Formata preço para exibição
 */
function formatPrice(value) {
    return Number(value).toLocaleString('pt-MZ', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Seleciona um tamanho e avança para a próxima etapa
 */
function selectSize(size, price, cardEl) {
    // Marcar card como selecionado
    document.querySelectorAll('.size-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');

    selectedSize = size;
    selectedPrice = price;

    // Disparar evento AddToCart
    if (typeof fbq === 'function') {
        fbq('track', 'AddToCart', {
            content_name: size,
            value: price,
            currency: 'MZN'
        });
    }

    // Avançar após animação breve
    setTimeout(() => goToStep(2), 400);
}

// ======== UPLOAD DE FOTO ========

/**
 * Processa o arquivo selecionado
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tamanho (máx. 20MB)
    if (file.size > 20 * 1024 * 1024) {
        alert('O arquivo é muito grande. O tamanho máximo é 20MB.');
        return;
    }

    // Validar tipo
    const validTypes = ['image/jpeg', 'image/png', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
        alert('Formato não suportado. Use JPG, PNG ou TIFF.');
        return;
    }

    uploadedFile = file;

    // Mostrar pré-visualização
    const reader = new FileReader();
    reader.onload = function (ev) {
        const preview = document.getElementById('image-preview');
        const uploadArea = document.getElementById('upload-area');
        const uploadIcon = document.getElementById('upload-icon');
        const uploadText = document.getElementById('upload-text');
        const uploadHint = document.getElementById('upload-hint');
        const btnContinue = document.getElementById('btn-continue');

        preview.src = ev.target.result;
        preview.style.display = 'block';
        uploadArea.classList.add('has-image');
        uploadIcon.style.display = 'none';
        uploadText.style.display = 'none';
        uploadHint.style.display = 'none';

        // Mostrar botões de ação do carrinho
        document.getElementById('btn-add-more').style.display = 'block';
        document.getElementById('btn-continue').style.display = 'block';
    };
    reader.readAsDataURL(file);
    uploadedFile = file; // Salvar o arquivo no estado

    // Resetar o valor do input para permitir selecionar o mesmo arquivo novamente/trocar sem bugs
    e.target.value = '';
}

/**
 * Adiciona o quadro atual ao carrinho e volta para escolha de tamanho
 */
function adicionarAoCarrinho() {
    if (!selectedSize || !uploadedFile) {
        showKSAlert('Por favor, selecione um tamanho e envie uma foto.');
        return;
    }

    const previewUrl = document.getElementById('image-preview').src;

    carrinho.push({
        tamanho: selectedSize,
        preco: selectedPrice,
        file: uploadedFile,
        previewUrl: previewUrl
    });

    // Resetar seleção atual
    selectedSize = null;
    selectedPrice = null;
    uploadedFile = null;
    uploadedImageUrl = null;

    // Resetar UI
    const uploadArea = document.getElementById('upload-area');
    const preview = document.getElementById('image-preview');
    uploadArea.classList.remove('has-image');
    preview.style.display = 'none';
    document.getElementById('upload-icon').style.display = 'block';
    document.getElementById('upload-text').style.display = 'block';
    document.getElementById('upload-hint').style.display = 'block';
    document.getElementById('btn-add-more').style.display = 'none';
    document.getElementById('btn-continue').style.display = 'none';

    goToStep(1);
    showKSAlert('✅ Quadro adicionado ao carrinho!');
}

/**
 * Remove um item do carrinho
 */
async function removerDoCarrinho(index) {
    if (await showKSConfirm('Deseja remover este quadro do carrinho?')) {
        carrinho.splice(index, 1);
        updateSummary();
        if (carrinho.length === 0 && !uploadedFile) {
            goToStep(1);
        }
    }
}


// ======== FINALIZAR PEDIDO ========

/**
 * Finaliza o pedido, enviando fotos e criando registros no Supabase
 */
async function finalizarPedido(e) {
    if (e) e.preventDefault();

    // Preparar lista de itens para processar
    let itensParaProcessar = [...carrinho];
    if (selectedSize && uploadedFile) {
        itensParaProcessar.push({
            tamanho: selectedSize,
            preco: selectedPrice,
            file: uploadedFile
        });
    }

    if (itensParaProcessar.length === 0) {
        showKSAlert('Seu carrinho está vazio!');
        goToStep(1);
        return;
    }

    showLoading(`Processando ${itensParaProcessar.length} quadro(s)...`);

    const orderGroupId = 'KS-' + Math.floor(Math.random() * 9000 + 1000);
    let orderDetails = [];
    let totalGeral = 0;

    if (supabaseClient) {
        for (let i = 0; i < itensParaProcessar.length; i++) {
            const item = itensParaProcessar[i];
            const orderId = `${orderGroupId}-${i + 1}`;
            let imageUrl = '';

            try {
                // 1. Upload da imagem para o Supabase Storage
                const fileExt = item.file.name.split('.').pop();
                const fileName = `${orderId}_${Date.now()}.${fileExt}`;

                const { data: uploadData, error: uploadError } = await supabaseClient
                    .storage
                    .from('order-images')
                    .upload(fileName, item.file);

                if (uploadError) {
                    console.error(`Erro no upload do item ${i + 1}:`, uploadError);
                } else {
                    const { data: urlData } = supabaseClient
                        .storage
                        .from('order-images')
                        .getPublicUrl(fileName);
                    imageUrl = urlData.publicUrl;
                }

                // 2. Criar pedido na tabela 'orders'
                const { error: orderError } = await supabaseClient
                    .from('orders')
                    .insert([{
                        id: orderId,
                        tamanho: item.tamanho,
                        preco: item.preco,
                        imagem_url: imageUrl,
                        status: 'Pendente'
                    }]);

                if (orderError) {
                    console.error("ERRO SUPABASE DE INSERT ORDER:", orderError);
                    alert("Falha Database: " + (orderError.message || JSON.stringify(orderError)));
                    throw orderError;
                }

                orderDetails.push({ id: orderId, tamanho: item.tamanho, preco: item.preco });
                totalGeral += item.preco;

            } catch (e) {
                console.error(`Erro ao processar item ${i + 1}:`, e);
                alert(`Erro Crítico na Criação do Item: ` + e.message);
                // Impede o redirecionamento com OrderInvalido:
                hideLoading();
                return;
            }
        }
    }

    // Esconder loading
    hideLoading();

    // Disparar evento Meta Pixel
    if (typeof fbq === 'function') {
        fbq('track', 'Purchase', {
            value: totalGeral,
            currency: 'MZN',
            content_ids: orderDetails.map(d => d.id),
            content_type: 'product'
        });
    }

    // 3. Redirecionar para o Novo Sistema de Chat

    // Salvar itens processados e o ID do Pedido no LocalStorage temporariamente
    // para carregamento suave na primeira tela de onboarding se necessário
    localStorage.setItem('ksbold_current_order', orderGroupId);
    localStorage.setItem('ksbold_order_total', totalGeral);

    // Ir para a URL do Chat PWA com o parâmetro order_id
    window.location.href = `/chat?order_id=${orderGroupId}`;
}

/**
 * Finaliza o pedido, enviando fotos e registros no Supabase,
 * mass direciona o usuário para o WhatsApp nativo.
 */
async function finalizarPedidoComAutomacao(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('client-name-final').value.trim();
    const whatsapp = document.getElementById('client-whatsapp-final').value.trim();

    if (!name || !whatsapp) {
        showKSAlert('Por favor, preencha o seu Nome e WhatsApp para receber o recibo.');
        return;
    }

    let itensParaProcessar = [...carrinho];
    if (selectedSize && uploadedFile) {
        itensParaProcessar.push({
            tamanho: selectedSize,
            preco: selectedPrice,
            file: uploadedFile
        });
    }

    if (itensParaProcessar.length === 0) {
        showKSAlert('Seu carrinho está vazio!');
        goToStep(1);
        return;
    }

    showLoading(`Processando ${itensParaProcessar.length} quadro(s)...`);

    const orderGroupId = 'KS-' + Math.floor(Math.random() * 9000 + 1000);
    let totalGeral = 0;

    if (supabaseClient) {
        let ordersToInsert = [];

        for (let i = 0; i < itensParaProcessar.length; i++) {
            const item = itensParaProcessar[i];
            const orderId = `${orderGroupId}-${i + 1}`;
            let imageUrl = '';

            try {
                // 1. Upload da imagem
                const fileExt = item.file.name.split('.').pop();
                const fileName = `${orderId}_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabaseClient.storage
                    .from('order-images').upload(fileName, item.file);

                if (!uploadError) {
                    const { data: urlData } = supabaseClient.storage
                        .from('order-images').getPublicUrl(fileName);
                    imageUrl = urlData.publicUrl;
                }

                // 2. Acumular dados do cliente para a insercao unica
                ordersToInsert.push({
                    id: orderId,
                    tamanho: item.tamanho,
                    preco: item.preco,
                    imagem_url: imageUrl,
                    status: 'Pendente',
                    client_name: name,
                    client_phone: whatsapp
                    // notificado = false eh o DEFAULT do banco de dados
                });

                totalGeral += item.preco;

            } catch (e) {
                console.error("Erro no upload da imagem:", e);
                // Continua para tentar as proximas imagens em vez de falhar tudo
            }
        }

        // 3. Inserir todos os pedidos juntos em Lote (BULK INSERT) para que o Bot leia todos ao mesmo tempo!
        if (ordersToInsert.length > 0) {
            try {
                const { error: orderError } = await supabaseClient
                    .from('orders')
                    .insert(ordersToInsert);

                if (orderError) throw orderError;
            } catch (e) {
                console.error("Erro no bulk insert das ordens:", e);
                hideLoading();
                showKSAlert('Erro ao processar pedido. Tente novamente.');
                return;
            }
        }
    }

    hideLoading();

    // Pixel tracking
    if (typeof fbq === 'function') {
        fbq('track', 'Purchase', { value: totalGeral, currency: 'MZN' });
    }

    // Sucesso Premium
    showKSSuccessModal(name, orderGroupId);
}

function showKSSuccessModal(name, orderId) {
    const overlay = document.createElement('div');
    overlay.className = 'ks-modal-overlay';
    overlay.style.zIndex = "3000";
    overlay.innerHTML = `
        <div class="ks-modal" style="text-align:center;">
            <div class="ks-modal-icon" style="font-size: 50px;">🎉</div>
            <div class="ks-modal-title">Pedido Confirmado!</div>
            <div class="ks-modal-message" style="margin-bottom: 20px;">
                Olá <strong>${name}</strong>, o seu pedido <strong>#${orderId}</strong> foi recebido com sucesso!<br><br>
                Acabámos de enviar uma mensagem para o seu <strong>WhatsApp</strong> com o recibo e os dados para pagamento.
            </div>
            <div class="ks-modal-actions">
                <button class="ks-modal-btn ks-modal-btn-primary" onclick="location.reload()">Entendido</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('visible'), 10);
}

// ======== META PIXEL DINÂMICO ========

/**
 * Carrega e injeta o Meta Pixel se estiver ativo no Supabase
 */
/**
 * Carrega e injeta o Meta Pixel se estiver ativo no Supabase
 */
async function loadMetaPixel() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('settings')
            .select('meta_pixel_id, pixel_ativo')
            .eq('id', 1)
            .single();

        if (error || !data) return;
        if (!data.pixel_ativo || !data.meta_pixel_id) {
            console.log('🔇 Meta Pixel desativado ou ID ausente.');
            return;
        }

        const pixelId = data.meta_pixel_id;

        // Inicializar Pixel se a função fbq existir (injetada no index.html)
        if (typeof fbq === 'function') {
            console.log('📡 Inicializando Meta Pixel:', pixelId);
            fbq('init', pixelId);
            fbq('track', 'PageView');

            // Noscript fallback dinâmico (opcional, mas bom ter)
            const noscript = document.createElement('noscript');
            noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
            document.head.appendChild(noscript);
        } else {
            console.warn('⚠️ Meta Pixel script base não encontrado no index.html');
        }

    } catch (e) {
        console.warn('Erro ao carregar Meta Pixel:', e);
    }
}

// ======== LOADING OVERLAY ========

function showLoading(text) {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
      <div class="spinner"></div>
      <p class="loading-text">${text || 'Carregando...'}</p>
    `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.loading-text').textContent = text || 'Carregando...';
    }
    requestAnimationFrame(() => overlay.classList.add('visible'));
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

// ======== ATUALIZAR RESUMO DO PEDIDO ========

/**
 * Atualiza as informações do resumo na etapa 4 (Carrinho)
 */
function updateSummary() {
    const container = document.getElementById('cart-list');
    const totalContainer = document.querySelector('#cart-total strong');
    if (!container) return;
    
    container.innerHTML = '';
    let total = 0;

    // 1. Itens já no carrinho
    carrinho.forEach((item, index) => {
        const preco = item.preco || mapaPrecosGlobal[item.tamanho] || 0;
        total += Number(preco);
        container.innerHTML += `
            <div class="cart-item">
                <img src="${item.previewUrl}" class="cart-item-preview" alt="Miniatura">
                <div class="cart-item-info">
                    <span>Quadro ${index + 1} (${item.tamanho})</span>
                    <strong>MT ${formatPrice(preco)}</strong>
                </div>
                <button class="btn-remove-item" onclick="removerDoCarrinho(${index})">×</button>
            </div>
        `;
    });

    // 2. Item atual (em configuração)
    if (selectedSize && uploadedFile) {
        const previewUrl = document.getElementById('image-preview').src;
        const precoAtual = selectedPrice || mapaPrecosGlobal[selectedSize] || 0;
        total += Number(precoAtual);
        container.innerHTML += `
            <div class="cart-item current-item" style="border: 1.5px solid var(--accent-gold); background: rgba(212, 184, 150, 0.05);">
                <img src="${previewUrl}" class="cart-item-preview" alt="Miniatura">
                <div class="cart-item-info">
                    <span>Quadro ${carrinho.length + 1} (${selectedSize})</span>
                    <strong>MT ${formatPrice(precoAtual)}</strong>
                </div>
                <span class="badge-atual" style="font-size: 9px; color: var(--accent-gold); position: absolute; top: 4px; right: 8px; text-transform: uppercase; font-weight: 700;">Atual</span>
            </div>
        `;
    }

    if (totalContainer) {
        totalContainer.innerText = `MT ${formatPrice(total)}`;
    }

    if (carrinho.length === 0 && (!selectedSize || !uploadedFile)) {
        container.innerHTML = '<p style="text-align:center; color:#999; font-size:13px; margin:20px 0;">O seu carrinho está vazio.</p>';
    }
}

function adicionarNovoQuadro() {
    // Se tem um item sendo configurado, coloca no carrinho primeiro
    if (selectedSize && uploadedFile) {
        carrinho.push({
            tamanho: selectedSize,
            preco: mapaPrecosGlobal[selectedSize] || 0,
            file: uploadedFile,
            previewUrl: URL.createObjectURL(uploadedFile)
        });
        
        // Limpa seleção para o próximo
        selectedSize = null;
        uploadedFile = null;
        document.querySelectorAll('.size-card').forEach(c => c.classList.remove('selected'));
        const uploadArea = document.querySelector('.upload-area');
        if (uploadArea) {
            uploadArea.classList.remove('has-image');
            uploadArea.innerHTML = `
                <div class="upload-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg></div>
                <div class="upload-text">Toque para carregar foto</div>
                <div class="upload-hint">Formatos: JPG, PNG ou HEIC</div>
                <img src="" class="image-preview" id="image-preview">
            `;
        }
    }
    
    // Volta para escolha do tamanho
    goToStep(1);
}


// Observar mudanças de etapa para atualizar resumo
const originalGoToStep = goToStep;
goToStep = function (stepIndex) {
    originalGoToStep(stepIndex);
    if (stepIndex === 3) updateSummary();
};

// ======== INICIALIZAÇÃO ========

document.addEventListener('DOMContentLoaded', function () {
    // Ativar primeira etapa
    document.querySelector('.step-1').classList.add('active');

    // Carregar preços
    loadPrices();

    // Carregar Meta Pixel
    loadMetaPixel();

    // Carregar Galeria
    loadGalleryImages();

    // Evento de upload de ficheiro
    document.getElementById('file-input').addEventListener('change', handleFileSelect);

    // Rastrear visita
    trackVisit();
});

/**
 * Rastreia uma visita única a cada 24 horas
 */
async function trackVisit() {
    if (!supabaseClient) return;

    try {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        let visitorId = localStorage.getItem('ksbold_visitor_id');
        let lastVisit = localStorage.getItem('ksbold_last_visit');

        // Gerar ID se não existir
        if (!visitorId) {
            visitorId = 'v-' + Math.random().toString(36).substr(2, 9) + '-' + now;
            localStorage.setItem('ksbold_visitor_id', visitorId);
        }

        // Se nunca visitou ou passou 24h
        if (!lastVisit || (now - parseInt(lastVisit)) > oneDay) {
            const { error } = await supabaseClient
                .from('visits')
                .insert([{ visitor_id: visitorId }]);

            if (!error) {
                localStorage.setItem('ksbold_last_visit', now.toString());
                console.log('🌐 Visita registada.');
            } else {
                console.warn('Erro ao registar visita:', error.message);
            }
        }
    } catch (e) {
        console.warn('Falha no rastreio de visita:', e);
    }
}

// ======== PRESENÇA ONLINE (REALTIME) ========
(function initPresence() {
    if (!supabaseClient) return;
    try {
        const visitorId = 'v_' + Math.random().toString(36).substr(2, 9);
        const channel = supabaseClient.channel('online-users', {
            config: { presence: { key: visitorId } }
        });
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                channel.track({ type: 'visitor', joined_at: new Date().toISOString() });
            }
        });
    } catch (e) {
        console.warn('Presença online não iniciada:', e);
    }
})();
