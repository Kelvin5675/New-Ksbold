# Licença e Documentação do Sistema KSBOLD

**Proprietário e Produtor:** Kelvin Edilson Irankunda 
**Direitos Autorais:** © 2026 Kelvin Edilson Irankunda. Todos os direitos reservados.

Esta documentação detalha a arquitetura, linguagens, pastas, arquivos e funcionalidades presentes no sistema KSBOLD - Fine Art Studio. Este documento também atua como a licença oficial do software, cuja propriedade intelectual e direitos de uso pertencem integralmente a **Kelvin Edilson Irankunda**.

---

## 1. Licença de Uso e Propriedade

1. **Titularidade:** Todo o código-fonte, design, estrutura de dados, lógica de negócio e interface aqui contidos são de criação e propriedade exclusiva de **Kelvin Edilson Irankunda**.
2. **Proibições:** É estritamente proibida a cópia, reprodução, alteração, venda ou redistribuição de qualquer parte deste sistema sem a autorização expressa e por escrito do proprietário.
3. **Uso Exclusivo:** Qualquer implantação, modificação do núcleo do sistema ou uso comercial não autorizado viola os termos de propriedade intelectual estabelecidos por Kelvin Edilson Irankunda.

---

## 2. Visão Geral do Sistema

O sistema **KSBOLD** é uma aplicação completa (Frontend Público + Painel de Administração) estruturada para um estúdio de Fine Art. O sistema conta com uma interface dinâmica e minimalista para clientes e uma robusta área restrita para o administrador gerenciar pedidos, preços, dados de rastreio de visitantes (Meta Pixel) e a galeria pública.

---

## 3. Linguagens de Programação Utilizadas

A solução é pautada por um modelo de desenvolvimento voltado à web moderna utilizando as seguintes tecnologias:
- **HTML5:** Utilizado para criar toda a estrutura semântica tanto da aplicação do cliente da loja (`index.html`) quanto da interface do administrador (`admin.html`).
- **CSS3:** Responsável pela identidade visual de ponta a ponta (arquivos `style.css` e `admin.css`), oferecendo extrema responsividade para acesso móvel e desktop, além de animações de transições entre passos (_slide vertical_) e efeitos gráficos fluídos.
- **JavaScript (Vanilla JS - ES6+):** É o cérebro das funcionalidades executadas no navegador (frontend) (arquivos `script.js` e `admin.js`), incluindo consumo da API do Supabase, upload dos arquivos para o storage, construção dinâmica do DOM, notificações animadas, e manipulação de estado do carrinho.

---

## 4. Arquitetura de Dados (Backend as a Service)

A base de dados, a autenticação e o armazenamento de imagens (Storage) são orquestrados através do **Supabase** (que atua como backend/PostgreSQL gerenciado).

As tabelas de banco de dados utilizadas no sistema incluem:
- **`orders` (Pedidos):** Armazena as faturas/pedidos feitos pelos clientes. Colunas identificadas: `id`, `tamanho`, `preco`, `imagem_url`, `status` (Pendente, Completo, Cancelado), `created_at`.
- **`prices` (Preços):** Mantém os preços atrelados aos tamanhos de quadros configuráveis em tempo real. Colunas: `tamanho`, `preco`.
- **`gallery` (Galeria de Imagens):** Armazena as imagens visíveis no carrossel da tela inicial do cliente. Colunas: `id`, `url`, `created_at`.
- **`settings` (Configurações do Sistema):** Configurações globais controladas no painel de administração. Colunas: `id`, `meta_pixel_id`, `pixel_ativo`.
- **`visits` (Estatísticas de Visita):** Registra rastreios baseados em cookies/identificação geridas localmente para contar usuários diários e exibir nas estatísticas do Admin. Colunas: `visitor_id`, `created_at`.

**Armazenamento de Arquivos / Supabase Storage (Buckets):**
- **`order-images`:** Guarda as imagens que os clientes sobem para a impressão na nuvem.
- **`gallery-images`:** Armazena as imagens enviadas pelo administrador para aparecerem no carrossel da Landing Page.

---

## 5. Estrutura de Pastas e Arquivos

O repositório e a implantação encontram-se estruturados a partir da raiz (diretório principal) com os seguintes arquivos e diretórios fundamentais:

* **`.git/`** – Pasta interna de controle de versão (repositório local Git).
* **`node_modules/`** – Contém dependências instaladas via gerenciador corporativo NPM, mas o envio é estático para a hospedagem web.
* **`admin.css`** – Arquivo com as declarações de folhas de estilo específicas para o dashboard e painel de login exclusivo da equipe de administração.
* **`admin.html`** – Interface modular em abas (Visão Geral, Vendas, Galeria, Configurações) onde os usuários administradores gerem todo o negócio KSBOLD.
* **`admin.js`** – Lógica completa e scripts do painel administrador, como: manipulação e leitura dos pedidos na base de dados, alteração de status, alteração dos preços exibidos no site, integração de upload de fotos de galeria e edição do evento Meta Pixel.
* **`index.html`** – A página principal e fluxo de clientes KSBOLD. Mostra a página inicial, formulário de 4 passos com seleção de quadro, upload em tela, carrinho de múltiplos itens e encaminhamento para a equipa da KSBOLD (via WhatsApp).
* **`script.js`** – O sistema vital do cliente que integra o `index.html` com o backend, realiza pré-visualização de fotos na memória do navegador do cliente, controla o limite de tamanho (MAX 20MB) das fotos e formata o envio automático de compra vinculando com os URLs seguros do Bucket e integração via WhatsApp (258834355768).
* **`style.css`** – Folha de estilos minimalista (frontend público). Define cores temáticas e animações do slider de galeria.
* **`package.json` / `package-lock.json`** – Arquivos descritores de pacote, documentando a dependência do módulo oficial do Supabase (`@supabase/supabase-js`).
* **`supabase.min.js`** – Versão oficial minificada da ferramenta de integração Supabase, mantida localmente impedindo o sistema de quebrar nos ambientes onde um CDN possa não operar corretamente.
* **`vercel.json`** – Arquivo de configuração de roteamento de hospedagem e implantação (Deploy configurado para Vercel), reescrevendo URLs como o percurso principal `/admin` de forma otimizada para ler o core em `/admin.html`.
* **`Logo Ksbold.jpg`** – Imagem da logomarca/brand da marca.

---

## 6. Funcionalidades Detalhadas do Sistema

### 6.1 Lado do Cliente / Visitantes (Frontend Público)
- **Carrossel Inteligente de Imagens:** Visualizador dinâmico de galeria com temporizador fluído contendo os cliques na página de aterragem atualizados pelo backend do Supabase.
- **Transições Interativas (Steps Verticais):** O site atua em uma única e robusta estrutura interativa vertical separada por painéis/etapas (Landing Page → Tamanho → Upload da Foto com Preview e validações seguras → Múltipla Adição e Carrinho Pessoal).
- **Extrato via WhatsApp Integrado Dinâmico:** Ao finalizar a encomenda, o script calcula o formato total perante cada seleção, gera identificadores aleatórios de subgrupos e efetua o parse dos detalhes através de uma hiperligação para o WhatsApp Oficial na hora da encomenda; isso garante atendimento direto à venda e conversão rápida.
- **Módulo Multi-Eventos do Meta Pixel Dinâmico:** Ferramenta reativa acoplada em background que espia o funil da transação através de etapas nativas com Pixel (Eventos _PageView_, _ViewContent_, _AddToCart_, _InitiateCheckout_ e finalmente _Purchase_ integrados internamente aos cliques).
- **Motor de Registro Diário:** O site usa recursos únicos de contagem de sessões dos usuários com bloqueadores em localStorage, limitando contabilizações inválidas e fornecendo dados reais aos analíticos ao fim do dia.

### 6.2 Lado do Gestor KSBOLD (Painel Dashboard)
- **Segurança e Autenticação Criptografada:** Utiliza os meios de Supabase Auth com contingência local baseada no administrador de email padrão.
- **Gráficos e Estatísticas ao Vivo do Estúdio:** Cards exibindo imediatamente o faturamento local em Meticais (Ex.: `MT 4.500.00`), total de encomendas criadas na história somadas ao monitor de visitas únicas diárias ativas no painel.
- **Manuseador Oficial de Tráfego Afiliado:** Gestor em interface para ativação local ou revogação com a simples alteração nativa do Código do "Pixel ID", essencial aos peritos em remarketing da plataforma.
- **Controle Total sobre o Estoque de Vendas e Arquivos de Alta Resolução:** Exibição da árvore das vendas e de subgrupos que contam pedidos múltiplos vinculados ao ID base. Modal responsivo full-screen para examinar na íntegra a fotografia do cliente antes de baixá-la com gatilhos de forçar o Download Raw contornando extensões quebradas em navegadores restritos.
- **CMS Embutido do Menu (Painel Rápido de Preços):** Gestor modular simples inserido no dashboard que garante a total alteração individual do layout base do estúdio sob demanda na edição de Preços de A0 a A5 para Meticais sem que haja uso de programadores.
- **Automação da Galeria do Estúdio:** O cliente carrega da máquina dele direto à nuvem e vê no mesmo segundo em real-time suas novas artes no website para atraírem clientela.
