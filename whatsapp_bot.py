import os
import time
import json
import requests
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer, HTTPServer

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
else:
    sys.stdout.reconfigure(line_buffering=True)

from supabase import create_client, Client

# --- CONFIGURAÇÕES KSBOLD (Variáveis de Ambiente) ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://zqsxmzbshsozggcwvxla.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "") 
WHATSAPP_API_URL = os.getenv("WHATSAPP_API_URL", "https://ksbold-evolution-api.onrender.com/message/sendText/ksbold-loja")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "ksbold-secreta-1234")

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

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"Bot is alive!")

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
