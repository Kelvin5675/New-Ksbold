import os
import time
import json
import requests
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
from supabase import create_client, Client

# --- CONFIGURAÇÕES KSBOLD ---
# Substitua pelos dados do seu config.js ou .env
SUPABASE_URL = "https://zqsxmzbshsozggcwvxla.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxc3htemJzaHNvemdnY3d2eGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzMwODUsImV4cCI6MjA4NzU0OTA4NX0.Neo-VHUaq7Zwk211QLdg-GEMKgyrouJfl7QepTJZCvk"
WHATSAPP_API_URL = "https://ksbold-evolution-api.onrender.com/message/sendText/ksbold-loja" # O teu URL do Render

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    headers = {'Content-Type': 'application/json', 'apikey': 'ksbold-secreta-1234'}
    
    try:
        requests.post(WHATSAPP_API_URL, data=json.dumps(payload), headers=headers)
        print("✅ Mensagem enviada com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao enviar: {e}")

def processar_pedido(pedido):
    """
    Formata a mensagem de parabéns e detalhes do pedido.
    Lê o template do banco de dados (editável pelo Admin).
    """
    numero_raw = str(pedido.get('client_phone', '')).strip()
    # Adicionar o código de país (258 Moçambique) se faltar
    if numero_raw.startswith('8') and len(numero_raw) == 9:
        numero_formatado = f"258{numero_raw}"
    else:
        numero_formatado = numero_raw.replace('+', '')

    nome = pedido.get('client_name', 'cliente')
    order_id = pedido.get('id', 'N/A')
    tamanho = pedido.get('tamanho', 'N/A')
    preco = pedido.get('preco', 0)
    
    # Tentar carregar template personalizado do banco de dados
    try:
        result = supabase.table("bot_settings").select("value").eq("key", "whatsapp_template").execute()
        if result.data and result.data[0].get('value'):
            template = result.data[0]['value']
            msg = template.replace('{nome}', nome)
            msg = msg.replace('{order_id}', str(order_id))
            msg = msg.replace('{tamanho}', str(tamanho))
            msg = msg.replace('{preco}', f"{preco:.2f}")
            print("📝 Usando template personalizado do Admin.")
        else:
            raise Exception("Nenhum template encontrado, usando padrão.")
    except Exception as e:
        print(f"⚠️ Template padrão será usado: {e}")
        msg = f"🎉 *Parabéns, {nome}!* 🎉\n\n"
        msg += f"Recebemos o seu pedido de quadros na *KSBOLD* com sucesso!\n\n"
        msg += f"📦 *Pedido:* #{order_id}\n"
        msg += f"🖼️ *Tamanho:* {tamanho}\n"
        msg += f"💰 *Valor:* MT {preco:.2f}\n\n"
        msg += "━━━━━━━━━━━━━━━━━━━━━━\n"
        msg += "💳 *DADOS PARA PAGAMENTO:*\n"
        msg += "- *e-Mola:* 869312874\n"
        msg += "- *m-Kesh:* 834355768\n"
        msg += "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        msg += "Por favor, envie o comprovativo de pagamento aqui para iniciarmos a produção.\n"
        msg += "O seu recibo PDF também será gerado e enviado em breve."
    
    enviar_whatsapp(numero_formatado, msg)

def monitorar_pedidos():
    """
    Monitoriza a tabela 'orders' do Supabase em busca de novos pedidos 'Pendente'.
    """
    print("👀 Monitor de Pedidos KSBOLD Iniciado...")
    last_processed_id = None
    
    while True:
        try:
            # Busca o último pedido pendente que ainda não foi processado
            query = supabase.table("orders").select("*").eq("status", "Pendente").order("created_at", desc=True).limit(1).execute()
            
            if query.data:
                pedido = query.data[0]
                if pedido['id'] != last_processed_id:
                    processar_pedido(pedido)
                    last_processed_id = pedido['id']
            
            time.sleep(10) # Verifica a cada 10 segundos (para não gastar recursos)
        except Exception as e:
            print(f"⚠️ Erro no monitor: {e}")
            time.sleep(20)

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
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    print(f"✅ Servidor de Health-Check rodando na porta {port}")
    server.serve_forever()

if __name__ == "__main__":
    # Inicia o servidor de saúde em uma thread separada para o Render não dar erro
    threading.Thread(target=run_health_check_server, daemon=True).start()
    
    # Inicia o monitor de pedidos na thread principal
    monitorar_pedidos()
