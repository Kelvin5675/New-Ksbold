/* ============================================================
   KSBOLD — Script Principal (Cliente)
   ============================================================ */

// ======== CONFIGURAÇÃO SUPABASE ========
// IMPORTANTE: Substitua com suas credenciais reais do Supabase
const SUPABASE_URL = 'https://zqsxmzbshsozggcwvxla.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxc3htemJzaHNvemdnY3d2eGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzMwODUsImV4cCI6MjA4NzU0OTA4NX0.Neo-VHUaq7Zwk211QLdg-GEMKgyrouJfl7QepTJZCvk';
const WHATSAPP_NUMBER = '258834355768'; // Número com código do país

const supabaseClient = window.supabase
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

    images.forEach((img, idx) => {
        // Slide
        const item = document.createElement('div');
        item.className = 'carousel-item';
        item.innerHTML = `<img src="${img.url}" alt="Galeria KSBOLD ${idx + 1}" loading="lazy">`;
        track.appendChild(item);

        // Dot
        const dot = document.createElement('div');
        dot.className = `dot ${idx === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
            goToSlide(idx, images.length);
            resetCarouselTimer(images.length);
        });
        dotsContainer.appendChild(dot);
    });

    // Iniciar temporizador
    startCarouselTimer(images.length);
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

/**
 * Busca os preços da tabela 'prices' e renderiza os cards de tamanho
 */
async function loadPrices() {
    const grid = document.getElementById('size-grid');

    // Preços padrão (fallback se Supabase não estiver configurado)
    let prices = [
        { tamanho: 'A0', preco: 600.00 },
        { tamanho: 'A1', preco: 380.00 },
        { tamanho: 'A2', preco: 250.00 },
        { tamanho: 'A3', preco: 180.00 },
        { tamanho: 'A4', preco: 120.00 },
        { tamanho: 'A5', preco: 80.00 }
    ];

    // Tentar buscar do Supabase
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('prices')
                .select('tamanho, preco')
                .order('tamanho');

            if (!error && data && data.length > 0) {
                prices = data;
            }
        } catch (e) {
            console.warn('Supabase não configurado, usando preços padrão.', e);
        }
    }

    // Renderizar cards
    grid.innerHTML = '';
    prices.forEach(item => {
        const card = document.createElement('div');
        card.className = 'size-card';
        card.setAttribute('data-size', item.tamanho);
        card.setAttribute('data-price', item.preco);
        card.innerHTML = `
      <div class="size-card-icon">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 16l5-5 4 4 4-6 5 7"/>
        </svg>
      </div>
      <div class="size-name">${item.tamanho}</div>
      <div class="size-price">MT ${formatPrice(item.preco)}</div>
    `;
        card.addEventListener('click', () => selectSize(item.tamanho, item.preco, card));
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
}

/**
 * Adiciona o quadro atual ao carrinho e volta para escolha de tamanho
 */
function adicionarAoCarrinho() {
    if (!selectedSize || !uploadedFile) {
        alert('Por favor, selecione um tamanho e envie uma foto.');
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
    alert('✅ Quadro adicionado ao carrinho!');
}

/**
 * Remove um item do carrinho
 */
function removerDoCarrinho(index) {
    if (confirm('Deseja remover este quadro do carrinho?')) {
        carrinho.splice(index, 1);
        updateSummary();
        if (carrinho.length === 0 && !uploadedFile) {
            goToStep(1);
        }
    }
}


// ======== FINALIZAR PEDIDO ========

/**
 * Cria o pedido no Supabase e abre o WhatsApp
 */
/**
 * Finaliza o pedido, enviando fotos e criando registros no Supabase
 */
async function finalizarPedido() {
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
        alert('Seu carrinho está vazio!');
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

                if (orderError) throw orderError;

                orderDetails.push({ id: orderId, tamanho: item.tamanho, preco: item.preco });
                totalGeral += item.preco;

            } catch (e) {
                console.error(`Erro ao processar item ${i + 1}:`, e);
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

    // 3. Montar mensagem unificada para WhatsApp
    let itemSummary = orderDetails.map(d => `• ${d.tamanho} (ID: ${d.id}): MT ${formatPrice(d.preco)}`).join('\n');

    const message = encodeURIComponent(
        `🖼️ *Novo Pedido KSBOLD (Múltiplos Itens)*\n\n` +
        `📦 *Carrinho:*\n${itemSummary}\n\n` +
        `💰 *Total Geral:* MT ${formatPrice(totalGeral)}\n` +
        `🆔 *Grupo:* ${orderGroupId}\n\n` +
        `Gostaria de finalizar meu pedido com esses quadros!`
    );

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
}


// ======== META PIXEL DINÂMICO ========

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
        if (!data.pixel_ativo || !data.meta_pixel_id) return;

        // Injetar script do Meta Pixel no head
        const pixelId = data.meta_pixel_id;
        const script = document.createElement('script');
        script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `;
        document.head.appendChild(script);

        // Noscript fallback
        const noscript = document.createElement('noscript');
        const img = document.createElement('img');
        img.height = 1;
        img.width = 1;
        img.style.display = 'none';
        img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
        noscript.appendChild(img);
        document.head.appendChild(noscript);

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
 * Atualiza as informações do resumo na etapa 4
 */
/**
 * Atualiza as informações do resumo na etapa 4 (Carrinho)
 */
function updateSummary() {
    const cartList = document.getElementById('cart-list');
    const totalPriceEl = document.getElementById('cart-total-price');
    if (!cartList || !totalPriceEl) return;

    cartList.innerHTML = '';
    let total = 0;

    // 1. Itens já no carrinho
    carrinho.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <img src="${item.previewUrl}" class="cart-item-preview" alt="Miniatura">
            <div class="cart-item-info">
                <span>Quadro ${index + 1} (${item.tamanho})</span>
                <strong>MT ${formatPrice(item.preco)}</strong>
            </div>
            <button class="btn-remove-item" onclick="removerDoCarrinho(${index})">×</button>
        `;
        cartList.appendChild(itemEl);
        total += item.preco;
    });

    // 2. Item atual (se houver e não estiver no carrinho ainda)
    if (selectedSize && uploadedFile) {
        const previewUrl = document.getElementById('image-preview').src;
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <img src="${previewUrl}" class="cart-item-preview" alt="Miniatura">
            <div class="cart-item-info">
                <span>Quadro ${carrinho.length + 1} (${selectedSize})</span>
                <strong>MT ${formatPrice(selectedPrice)}</strong>
            </div>
            <div style="font-size: 10px; color: #d4b896; margin-top: 4px; border: 1px solid #d4b896; padding: 2px 4px; border-radius: 4px;">Atual</div>
        `;
        cartList.appendChild(itemEl);
        total += selectedPrice;
    }

    totalPriceEl.textContent = `MT ${formatPrice(total)}`;
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

