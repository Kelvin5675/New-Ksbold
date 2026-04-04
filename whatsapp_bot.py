import os
import time
import json
import requests
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer, HTTPServer

# Ajuste de encoding para terminais simples
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
except:
    pass

from supabase import create_client, Client
import google.generativeai as genai

# --- CONFIGURAÇÕES KSBOLD (Variáveis de Ambiente) ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://zqsxmzbshsozggcwvxla.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "") 
WHATSAPP_API_URL = os.getenv("WHATSAPP_API_URL", "https://ksbold-evolution-api.onrender.com/message/sendText/ksbold-loja")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "ksbold-secreta-1234")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Configurar Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print("🧠 Gemini IA configurado.")

# Verificação Crítica de Chaves
erros = []
if not SUPABASE_KEY: erros.append("SUPABASE_KEY")
if not SUPABASE_URL: erros.append("SUPABASE_URL")
if not EVOLUTION_API_KEY: erros.append("EVOLUTION_API_KEY")

if erros:
    print(f"❌ ERRO FATAL: Faltam variáveis de ambiente: {', '.join(erros)}")
    print("👉 Por favor, configure estas chaves no painel do Render (Environment Settings).")
    sys.exit(1)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Conectado ao Supabase com sucesso.")
except Exception as e:
    print(f"❌ Erro ao inicializar cliente Supabase: {e}")
    sys.exit(1)

def enviar_whatsapp(numero, mensagem):
    """
    Envia mensagem via WhatsApp usando uma ponte (Gateway).
    Podes usar a Evolution API (Grátis) para conectar o teu número.
    """
    print(f"🚀 Enviando mensagem para {numero}...")
    # Exemplo de payload para Evolution API ou similar
    payload = {
        "number": numero,
        "options": {"delay": 1200, "presence": "composing"},
        "textMessage": {"text": mensagem}
    }
    headers = {'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY}
    
    try:
        response = requests.post(WHATSAPP_API_URL, data=json.dumps(payload), headers=headers)
        if response.status_code in [200, 201]:
            print("✅ Mensagem enviada com sucesso!")
        else:
            print(f"⚠️ Resposta da API: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Erro ao enviar: {e}")

def processar_grupo(prefix, itens):
    """
    Consolida múltiplos itens do mesmo pedido em uma única mensagem.
    """
    # 1. Tentar travar TODOS os itens do grupo de forma atômica
    ids = [item['id'] for item in itens]
    try:
        lock_res = supabase.table("orders").update({"notificado": True}).in_("id", ids).eq("notificado", False).execute()
        
        # Se nenhum item foi travado com sucesso por este bot, sai
        if not lock_res.data:
            return
            
        # Consideramos apenas os itens que conseguimos travar
        itens_travados = lock_res.data
        ids_sucesso = [o['id'] for o in itens_travados]
        print(f"🔒 Bloqueados {len(ids_sucesso)} itens do pedido {prefix}. Consolidando...")
        
    except Exception as e:
        print(f"❌ Erro ao tentar reservar grupo {prefix}: {e}")
        return

    # 2. Preparar dados consolidados
    primeiro = itens_travados[0]
    nome = primeiro.get('client_name', 'cliente')
    numero_raw = str(primeiro.get('client_phone', '')).strip()
    
    if numero_raw.startswith('8') and len(numero_raw) == 9:
        numero_formatado = f"258{numero_raw}"
    else:
        numero_formatado = numero_raw.replace('+', '')

    lista_quadros = ""
    total = 0
    for i, item in enumerate(itens_travados):
        t = item.get('tamanho', 'N/A')
        p = item.get('preco', 0)
        total += p
        lista_quadros += f"- Quadro {i+1}: {t} (MT {p:.2f})\n"

    # 3. Tentar carregar template
    msg = ""
    try:
        result = supabase.table("bot_settings").select("value").eq("key", "whatsapp_template").execute()
        if result.data and result.data[0].get('value'):
            template = result.data[0]['value']
            msg = template.replace('{nome}', nome)
            msg = msg.replace('{order_id}', prefix)
            msg = msg.replace('{tamanho}', ", ".join([o.get('tamanho','N/A') for o in itens_travados]))
            msg = msg.replace('{preco}', f"{total:.2f}")
        else:
            raise Exception("Sem template configurado")
    except:
        msg = f"🎉 *Parabéns, {nome}!* 🎉\n\n"
        msg += f"Recebemos o seu pedido na *KSBOLD* com sucesso!\n\n"
        msg += f"📦 *Pedido:* #{prefix}\n"
        msg += f"🖼️ *Itens:*\n{lista_quadros}\n"
        msg += f"💰 *VALOR TOTAL:* MT {total:.2f}\n\n"
        msg += "━━━━━━━━━━━━━━━━━━━━━━\n"
        msg += "💳 *DADOS PARA PAGAMENTO:*\n"
        msg += "- *e-Mola:* 869312874\n"
        msg += "- *m-Kesh:* 834355768\n"
        msg += "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        msg += "Por favor, envie o comprovativo aqui para iniciarmos a produção."

    enviar_whatsapp(numero_formatado, msg)
    
    # 4. Enviar evento de compra ao Facebook (CAPI - Server-Side)
    enviar_evento_capi(numero_formatado, total, prefix)
    
    # 5. Alertar o CEO sobre a nova venda
    alertar_ceo(nome, prefix, total, len(itens_travados))

def enviar_evento_capi(telefone_cliente, valor_total, order_id):
    """
    Envia um evento 'Purchase' ao Facebook via Conversions API (Server-Side).
    Isso contorna bloqueadores de anúncios e restrições do iOS.
    """
    try:
        # Buscar credenciais do Supabase (cofre seguro)
        result = supabase.table("bot_settings").select("key, value").in_("key", ["meta_capi_token", "meta_pixel_id"]).execute()
        if not result.data:
            print("⚠️ CAPI: Sem token ou Pixel ID configurados. Ignorando evento.")
            return
        
        settings = {item['key']: item['value'] for item in result.data}
        capi_token = settings.get('meta_capi_token', '')
        pixel_id = settings.get('meta_pixel_id', '')
        
        if not capi_token or not pixel_id:
            print("⚠️ CAPI: Token ou Pixel ID vazios. Configure no Admin > Configurações.")
            return
        
        import hashlib
        # Hash do telefone (exigencia do Facebook para privacidade)
        phone_hash = hashlib.sha256(telefone_cliente.encode()).hexdigest()
        
        evento = {
            "data": [{
                "event_name": "Purchase",
                "event_time": int(time.time()),
                "action_source": "website",
                "user_data": {
                    "ph": [phone_hash]
                },
                "custom_data": {
                    "currency": "MZN",
                    "value": valor_total,
                    "order_id": order_id
                }
            }]
        }
        
        url = f"https://graph.facebook.com/v19.0/{pixel_id}/events?access_token={capi_token}"
        resp = requests.post(url, json=evento)
        
        if resp.status_code == 200:
            print(f"📊 CAPI: Evento 'Purchase' enviado ao Facebook! (Valor: MT {valor_total:.2f})")
        else:
            print(f"⚠️ CAPI: Resposta do Facebook: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"⚠️ CAPI: Erro (nao-critico): {e}")

def alertar_ceo(nome_cliente, order_id, valor_total, qtd_itens):
    """
    Envia uma notificação de nova venda ao WhatsApp pessoal do CEO.
    """
    try:
        result = supabase.table("bot_settings").select("key, value").in_("key", ["ceo_whatsapp", "ceo_alerts_ativo"]).execute()
        if not result.data:
            return
        
        settings = {item['key']: item['value'] for item in result.data}
        ceo_phone = settings.get('ceo_whatsapp', '')
        alerts_ativo = settings.get('ceo_alerts_ativo', 'false')
        
        if not ceo_phone or alerts_ativo != 'true':
            return
        
        alerta = f"🚨 *NOVA VENDA KSBOLD!* 🚨\n\n"
        alerta += f"👤 *Cliente:* {nome_cliente}\n"
        alerta += f"📦 *Pedido:* #{order_id}\n"
        alerta += f"🖼️ *Quadros:* {qtd_itens} item(ns)\n"
        alerta += f"💰 *Valor Total:* MT {valor_total:.2f}\n\n"
        alerta += f"📱 Abra o Painel Admin para ver os detalhes!"
        
        enviar_whatsapp(ceo_phone, alerta)
        print(f"🔔 Alerta de venda enviado ao CEO!")
    except Exception as e:
        print(f"⚠️ Alerta CEO: Erro (nao-critico): {e}")

def monitorar_pedidos():
    """
    Monitoriza a tabela 'orders' do Supabase em busca de novos pedidos 'Pendente'.
    """
    print("👀 Monitor de Pedidos KSBOLD Iniciado...")
    last_processed_id = None
    
    while True:
        try:
            # Busca todos os pedidos pendentes não notificados
            query = supabase.table("orders").select("*").eq("status", "Pendente").eq("notificado", False).execute()
            
            if query.data:
                # Agrupar por prefixo (ex: KS-1234)
                grupos = {}
                for item in query.data:
                    parts = str(item['id']).split('-')
                    if len(parts) >= 2:
                        prefix = f"{parts[0]}-{parts[1]}"
                        if prefix not in grupos: grupos[prefix] = []
                        grupos[prefix].append(item)
                
                for prefix, itens in grupos.items():
                    print(f"\n🔄 Iniciando processamento do pedido: {prefix} (Itens: {len(itens)})")
                    processar_grupo(prefix, itens)
                    # Atraso crítico para evitar Rate-Limit/Anti-Spam da API do WhatsApp
                    print("⏳ Aguardando 3 segundos antes do próximo cliente...")
                    time.sleep(3)
            
            time.sleep(8)
        except Exception as e:
            print(f"⚠️ Erro no monitor: {e}")
            time.sleep(20)

import socketserver

class ThreadedHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    """Handle requests in a separate thread."""
    daemon_threads = True

def get_ksbold_snapshot():
    """Colhe dados reais do banco para alimentar a IA."""
    try:
        # 1. Resumo de Pedidos (tabela 'orders')
        res = supabase.table("orders").select("total_price, status").execute()
        orders = res.data or []
        
        # 2. Resumo de Funil/Métricas (tabela 'metrics_funil')
        res_funil = supabase.table("metrics_funil").select("*").order("created_at", desc=True).limit(1).execute()
        funil = res_funil.data[0] if res_funil.data else {}

        # Cálculos de Negócio
        receita_paga = sum(float(o.get('total_price', 0)) for o in orders if o.get('status') == 'paid')
        total_pedidos = len(orders)
        pedidos_pendentes = len([o for o in orders if o.get('status') != 'paid'])
        
        snapshot = f"""
        [RELATÓRIO KSBOLD EM TEMPO REAL]
        - Pedidos Totais: {total_pedidos} ({pedidos_pendentes} pendentes)
        - Receita Confirmada: {receita_paga} MT
        - Performance Funil: {funil.get('home_views', 0)} visitas na home, {funil.get('checkout_views', 0)} no checkout.
        - Status: Sistema operacional e monitorando vendas.
        """
        return snapshot
    except Exception as e:
        print(f"⚠️ Erro ao colher snapshot: {e}")
        return "Dados reais indisponíveis no momento (erro de conexão com banco)."

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        
    def do_GET(self):
        # Adicionar CORS ao GET para o ping de status do Admin funcionar
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b"Bot is alive!")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def do_POST(self):
        # Sempre enviar cabeçalhos CORS básicos
        def send_cors_headers(response_code=200):
            self.send_response(response_code)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
            self.end_headers()

        if self.path == '/ai/chat':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data)
                user_msg = data.get('message', '')

                print(f"💬 [API] Recebida mensagem para Diretoria IA: {user_msg}")

                # Lógica do "Diretor IA" usando Gemini High-Intelligence + Real Data
                if not GEMINI_API_KEY:
                    reply = "⚠️ Erro: GEMINI_API_KEY não configurada no Render."
                else:
                    try:
                        # 1. Pegar dados REAIS da KSBOLD
                        snapshot = get_ksbold_snapshot()
                        history_data = data.get('history', [])
                        
                        # 2. Configurar Modelo
                        model_name = 'gemini-2.0-flash'
                        model = genai.GenerativeModel(model_name)
                        
                        system_prompt = f"""
                        [DIRETRIZES DE COMANDO - DIRETORIA IA KSBOLD]
                        Você é o Cérebro Estratégico por trás da KSBOLD, a marca líder em decoração, venda de quadros em tela foam board premium/básico em Moçambique.
                        Seu interlocutor é o CEO Kelvin. Fale com ele como um sócio de confiança: visão estratégica, foco em ROI e lealdade absoluta.

                        CONHECIMENTO PROFUNDO DA KSBOLD:
                        - Nicho: Quadros Decorativos Personalizados de Alta Qualidade.
                        - Diferencial: Impressão de luxo, molduras exclusivas e entrega rápida.
                        - Localização: Operação em Moçambique (Preços em Meticais - MT).
                        - Fluxo: O cliente escolhe/uploada uma foto no site -> Escolhe o tamanho -> Paga -> Recebe notificação automatizada via WhatsApp.

                        SUA MISSÃO COMO DIRETOR:
                        1. Analisar os dados do [SNAPSHOT] abaixo e sugerir melhorias.
                        2. Coordenar a Equipe de Agentes (Fase 6): designer, copywriter e social media.
                        3. Criar ideias de conteúdo viral para Reels/TikTok focado no nosso negócio.

                        [SNAPSHOT REAL-TIME DA EMPRESA]:
                        {snapshot}

                        REGRAS DE OURO:
                        - Use um tom Profissional, Elegante, Moçambicano e focado em Resultados.
                        - Você tem memória da conversa atual (Histórico abaixo). Use isso para manter o raciocínio.
                        """
                        
                        # Preparar corpo da conversa com contexto e histórico
                        contents = []
                        # Injetar sistema como primeira mensagem de contexto
                        contents.append({"role": "user", "parts": [system_prompt]})
                        contents.append({"role": "model", "parts": ["Entendido, CEO Kelvin. Estou pronto para gerir a KSBOLD com excelência. Como posso ajudar agora?"]})
                        
                        # Adicionar histórico recebido
                        for msg in history_data:
                            role = "user" if msg.get('role') == 'user' else "model"
                            contents.append({"role": role, "parts": [msg.get('text', '')]})
                        
                        # Garantir que a mensagem atual está no fim do histórico se não estiver duplicada
                        if not history_data or history_data[-1].get('text') != user_msg:
                            contents.append({"role": "user", "parts": [user_msg]})
                        
                        response = model.generate_content(contents)
                        reply = response.text

                    except Exception as ge:
                        print(f"❌ Erro Crítico Gemini ({model_name}): {ge}")
                        reply = f"❌ Erro ao acessar o cérebro: {str(ge)}"

                send_cors_headers(200)
                self.wfile.write(json.dumps({"reply": reply}).encode('utf-8'))

            except Exception as e:
                print(f"❌ [API] Erro no processamento: {e}")
                send_cors_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            send_cors_headers(404)
            self.wfile.write(json.dumps({"error": "Path not found"}).encode('utf-8'))


def run_health_check_server():
    try:
        port = int(os.environ.get("PORT", 8080))
        server = ThreadedHTTPServer(('0.0.0.0', port), HealthCheckHandler)
        print(f"✅ Servidor de Health-Check multicor rodando na porta {port}", flush=True)
        server.serve_forever()
    except Exception as e:
        print(f"❌ Falha FATAL ao abrir a porta do Health-Check: {e}", flush=True)

if __name__ == "__main__":
    # Inicia o servidor de saude em uma thread separada para o Render nao dar erro
    t = threading.Thread(target=run_health_check_server, daemon=True)
    t.start()
    
    # Inicia o monitor de pedidos na thread principal
    monitorar_pedidos()
