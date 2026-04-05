import os
import time
import json
import requests
import sys
import threading
import datetime
import subprocess

# --- AUTO-INSTALADOR DE SEGURANÇA (Para o Render não falhar) ---
def install_and_import(package, import_name):
    try:
        __import__(import_name)
    except ImportError:
        print(f"⚠️ Módulo {package} não encontrado. Instalando...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package, "--quiet"])
            print(f"✅ {package} instalado!")
        except Exception as e:
            print(f"❌ Erro ao instalar {package}: {e}")

install_and_import("google-generativeai", "google.generativeai")
install_and_import("supabase", "supabase")

import google.generativeai as genai
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer, HTTPServer
from supabase import create_client, Client

# --- CONFIGURAÇÕES KSBOLD ---
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
except: pass

# --- CONFIGURAÇÕES KSBOLD (Env Vars) ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://zqsxmzbshsozggcwvxla.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "") 
WHATSAPP_API_URL = os.getenv("WHATSAPP_API_URL", "https://ksbold-evolution-api.onrender.com/message/sendText/ksbold-loja")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "ksbold-secreta-1234")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "") # 🚀 NOVO: Fallback para Groq (Llama 3.1)

# --- CACHE DE RESPOSTAS (ECONOMIA DE COTA 429) ---
AI_CACHE = {}
LAST_GENERATED_IMAGE = None  # Guarda a última imagem gerada para exibir no chat

def get_cached_reply(message):
    m = message.strip().lower()
    if m in AI_CACHE:
        item = AI_CACHE[m]
        if time.time() < item['expires']: return item['reply']
    return None

def set_cached_reply(message, reply):
    m = message.strip().lower()
    AI_CACHE[m] = {"reply": reply, "expires": time.time() + 45}

# --- MÓDULO AGÊNCIA MULTI-AGENTE (Integrado) ---

class KSBoldMarketingAgency:
    def __init__(self, gemini_key, groq_key):
        self.gemini_key = gemini_key
        self.groq_key = groq_key
        if gemini_key: genai.configure(api_key=gemini_key)

    def agir_como_copywriter(self, briefing, snapshot):
        p = f"Você é o COPYWRITER KSBOLD (Luxo). Snapshot: {snapshot}. Briefing: {briefing}. Crie 3 legendas Insta."
        return self._ai_request(p)

    def agir_como_designer_prompt(self, briefing):
        p = f"Você é o DESIGNER KSBOLD. Crie um prompt de imagem de luxo para: {briefing}"
        return self._ai_request(p)

    def _ai_request(self, prompt):
        # Tenta Gemini primeiro para tarefas internas
        if self.gemini_key:
            try:
                model = genai.GenerativeModel('gemini-1.5-flash')
                return model.generate_content(prompt).text
            except: pass
        # Fallback para Groq se configurado
        if self.groq_key:
            try:
                headers = {"Authorization": f"Bearer {self.groq_key}", "Content-Type": "application/json"}
                data = {"model": "llama-3.1-70b-versatile", "messages": [{"role": "user", "content": prompt}]}
                resp = requests.post("https://api.groq.com/openai/v1/chat/completions", json=data, headers=headers)
                return resp.json()['choices'][0]['message']['content']
            except: pass
        return "Agente temporariamente indisponível."

    def orquestrar_campanha(self, tema, snapshot):
        c = self.agir_como_copywriter(f"Campanha {tema}", snapshot)
        v = self.agir_como_designer_prompt(f"Imagem {tema}")
        return {"tema": tema, "copy": c, "visual_concept": v}

# Inicializar IA
marketing_agency = KSBoldMarketingAgency(GEMINI_API_KEY, GROQ_API_KEY)
if GEMINI_API_KEY or GROQ_API_KEY:
    print("🧠 Cérebro Híbrido KSBOLD Online.")

# Conectar Supabase
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase OK.")
    # --- AUTO-SETUP TABELA DE MEMÓRIA ---
    try:
        supabase.table("ai_memory").select("count").limit(1).execute()
    except:
        print("⚠️ Criando tabela ai_memory...")
        # Como não temos DDL direto via Client as vezes, a IA vai 'aprender' a criar ou o Kelvin roda o SQL.
        # Mas vamos assumir que o Client pode ler se existir.
except:
    print("❌ Erro Supabase.")
    sys.exit(1)

def get_ai_memories():
    try:
        data = supabase.table("ai_memory").select("*").execute().data or []
        if not data: return "Nenhuma instrução especial gravada ainda."
        return "\n".join([f"- {m['key']}: {m['value']}" for m in data])
    except: return "Erro ao ler memorias."

def tool_salvar_memoria(chave, valor):
    """Grave uma informação importante para nunca esquecer (ex: nome do CEO, metas, regras)."""
    try:
        supabase.table("ai_memory").upsert({"key": chave, "value": valor}, on_conflict="key").execute()
        return f"✅ Entendido. Gravei na minha mente que '{chave}' agora é '{valor}'."
    except Exception as e: return f"❌ Erro ao memorizar: {str(e)}"

# --- FUNÇÕES CORE (Envios e Monitor) ---

def enviar_whatsapp(num, msg):
    if not num: return
    p = {"number": num, "options": {"delay": 1000, "presence": "composing"}, "textMessage": {"text": msg}}
    h = {"Content-Type": "application/json", "apikey": EVOLUTION_API_KEY}
    try: requests.post(WHATSAPP_API_URL, json=p, headers=h)
    except: pass

def tool_enviar_whatsapp(numero, mensagem):
    """Envie uma mensagem de WhatsApp para qualquer numero (incluindo relatorios para o CEO)."""
    try:
        enviar_whatsapp(numero, mensagem)
        return f"✅ Relatorio/Mensagem enviada com sucesso para {numero}."
    except Exception as e: return f"❌ Erro ao enviar WhatsApp: {str(e)}"

def tool_enviar_midia_whatsapp(numero, media_base64, mime_type, legenda):
    """Envie PDFs ou Imagens para o WhatsApp. 'media_base64' é o conteudo visual base64. Mimetype pode ser 'image/jpeg' ou 'application/pdf'."""
    if not numero or not media_base64: return "Falta numero ou midia."
    media_url = WHATSAPP_API_URL.replace("sendText", "sendMedia")
    p = {
        "number": numero, 
        "options": {"delay": 1000, "presence": "composing"}, 
        "mediaMessage": {
            "mediatype": "document" if "pdf" in mime_type else "image",
            "caption": legenda,
            "media": f"data:{mime_type};base64,{media_base64}",
            "fileName": "documento.pdf" if "pdf" in mime_type else "imagem.jpg"
        }
    }
    h = {"Content-Type": "application/json", "apikey": EVOLUTION_API_KEY}
    try:
        res = requests.post(media_url, json=p, headers=h)
        return f"✅ Midia enviada para {numero}. {res.text}"
    except Exception as e: return f"❌ Erro midia: {str(e)}"


def get_ksbold_snapshot():
    try:
        orders = supabase.table("orders").select("preco, status").execute().data or []
        receita = sum(float(o.get('preco', 0)) for o in orders if o.get('status') == 'paid')
        return f"Pedidos: {len(orders)}. Receita: {receita} MT."
    except: return "Snapshot indisponivel."

def monitorar_pedidos():
    while True:
        try:
            q = supabase.table("orders").select("*").eq("status", "Pendente").eq("notificado", False).execute()
            if q.data:
                for it in q.data:
                    enviar_whatsapp(it.get('client_phone'), f"Olá {it.get('client_name')}, recebemos seu pedido de luxo #{it['id']}!")
                    supabase.table("orders").update({"notificado": True}).eq("id", it['id']).execute()
            time.sleep(15)
        except: time.sleep(30)

# --- TOOLS PARA A IA ---

def tool_executar_campanha(tema):
    try:
        res = marketing_agency.orquestrar_campanha(tema, get_ksbold_snapshot())
        return json.dumps(res, ensure_ascii=False)
    except Exception as e:
        return f"⚠️ Erro ao orquestrar: {str(e)}"

def tool_gerar_imagem(prompt, numero_whatsapp=""):
    """Gera uma imagem de alta qualidade a partir de um prompt de texto usando IA (Pollinations.ai, gratuito).
    Se numero_whatsapp for fornecido, envia a imagem diretamente para o WhatsApp."""
    global LAST_GENERATED_IMAGE
    try:
        from urllib.parse import quote
        # Adicionar estilo KSBOLD ao prompt
        full_prompt = f"{prompt}, luxury brand style, premium quality, dark elegant background, gold accents, KSBOLD Mozambique"
        url = f"https://image.pollinations.ai/prompt/{quote(full_prompt)}?width=1024&height=1024&nologo=true"
        
        # Baixar a imagem gerada
        img_resp = requests.get(url, timeout=60)
        if img_resp.status_code == 200:
            import base64
            img_b64 = base64.b64encode(img_resp.content).decode('utf-8')
            LAST_GENERATED_IMAGE = img_b64  # Guardar para exibir no chat
            
            # Se tiver número, enviar para WhatsApp
            if numero_whatsapp:
                result = tool_enviar_midia_whatsapp(numero_whatsapp, img_b64, "image/png", f"🎨 KSBOLD Design: {prompt}")
                return f"✅ Imagem gerada e enviada! {result}"
            
            return f"✅ Imagem gerada com sucesso! A imagem está pronta para ser visualizada."
        else:
            return f"⚠️ Erro ao gerar imagem: HTTP {img_resp.status_code}"
    except Exception as e:
        return f"❌ Erro na geração: {str(e)}"

# --- SERVER ---

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200); self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers()

    def do_GET(self):
        self.send_response(200); self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers()
        self.wfile.write(b"Bot Hibrido Online!")

    def do_OPTIONS(self):
        self.send_response(200); self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        def reply(d, c=200):
            self.send_response(c); self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers()
            self.wfile.write(json.dumps(d).encode())

        if self.path == '/ai/chat':
            try:
                data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                user_msg = data.get('message', '')
                
                cached = get_cached_reply(user_msg)
                if cached: return reply({'reply': cached})

                snap = get_ksbold_snapshot()
                mems = get_ai_memories()
                # Truncar memórias para não ultrapassar limites da Groq
                if len(mems) > 500: mems = mems[:500] + "..."
                now_dt = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
                
                # --- PERSONA COMPACTA (Otimizada para Groq) ---
                instruct = f"""DIRETOR ESTRATEGICO KSBOLD (Moçambique). Chefe: Sr. Kelvin (CEO).
MISSAO: Tornar KSBOLD referencia em Quadros de Luxo.
AGORA: {now_dt}. {snap}
MEMORIAS: {mems}
REGRAS: Fale com elegancia/luxo. Foco em ROI. NUNCA diga que e IA. Use tools quando necessario."""

                # --- GESTÃO DE HISTÓRICO (Limitado a 6 msgs para não estourar cota) ---
                messages_openai = [{"role": "system", "content": instruct}]
                history = data.get('history', [])
                # Manter apenas as últimas 6 mensagens do histórico
                if len(history) > 6:
                    history = history[-6:]
                for h in history:
                    r = "user" if h.get('role') == 'user' else "assistant"
                    msg_text = str(h.get('text', ''))[:500]  # Truncar msgs longas
                    messages_openai.append({"role": r, "content": msg_text})
                
                # Identifica o Kelvin (O Mestre)
                if len(messages_openai) == 1:
                    messages_openai.append({"role": "assistant", "content": "Ola Sr. Kelvin. Como posso elevar o ROI da KSBOLD hoje?"})
                
                messages_openai.append({"role": "user", "content": user_msg})

                final_text = ""
                ultimo_erro = "Aguardando resposta..."

                # --- 🤖 TENTATIVA 1: GEMINI (Omnipotente) ---
                if GEMINI_API_KEY:
                    for m_name in ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash']:
                        try:
                            # Adicionadas ferramentas completas
                            model = genai.GenerativeModel(m_name, system_instruction=instruct, tools=[tool_executar_campanha, tool_salvar_memoria, tool_enviar_whatsapp])
                            
                            hist_gem = []
                            # Garante que temos pelo menos 2 mensagens para histórico ou envia vazio
                            if len(messages_openai) > 2:
                                for m in messages_openai[1:-1]:
                                    role_gem = "user" if m['role'] == "user" else "model"
                                    hist_gem.append({"role": role_gem, "parts": [m['content']]})
                            
                            chat = model.start_chat(history=hist_gem)
                            resp = chat.send_message(user_msg)
                            
                            # Suporte Multi-Tool Roteado
                            part = resp.candidates[0].content.parts[0]
                            if part.function_call:
                                fn = part.function_call.name
                                args = part.function_call.args
                                if fn == "tool_executar_campanha": res_t = tool_executar_campanha(args['tema'])
                                elif fn == "tool_salvar_memoria": res_t = tool_salvar_memoria(args['chave'], args['valor'])
                                elif fn == "tool_enviar_whatsapp": res_t = tool_enviar_whatsapp(args['numero'], args['mensagem'])
                                else: res_t = "Erro: Ferramenta desconhecida."
                                
                                resp = chat.send_message(f"Resultado tecnico: {res_t}. Confirme ao Edilson.")
                            
                            final_text = resp.text
                            if final_text: break
                        except Exception as e_gem:
                            ultimo_erro = f"Gemini ({m_name}): {str(e_gem)}"
                            if "429" in ultimo_erro or "404" in ultimo_erro: continue
                            break
                
                # --- ⚡ TENTATIVA 2: GROQ (Llama 3.3 e 3.2 Vision) ---
                if not final_text and GROQ_API_KEY:
                    media = data.get('media') # { "mime_type": "image/jpeg", "data": "base64..." }
                    
                    # Se tiver mídia, forçar o modelo de Visão primeiro!
                    if media:
                        groq_models = ["llama-3.2-90b-vision-preview"]
                    else:
                        groq_models = ["llama-3.3-70b-versatile"]

                    for g_model in groq_models:
                        try:
                            headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
                            ms_groq = messages_openai.copy()
                            
                            # Se houver mídia e o modelo for vision, injetamos o payload de imagem
                            if media and "vision" in g_model:
                                last_msg = ms_groq[-1]["content"]
                                ms_groq[-1]["content"] = [
                                    {"type": "text", "text": last_msg},
                                    {"type": "image_url", "image_url": {"url": f"data:{media['mime_type']};base64,{media['data']}"}}
                                ]

                            data_groq = {"model": g_model, "messages": ms_groq, "temperature": 0.6, "max_tokens": 1500}
                            
                            # Adicionar payload de ferramentas se não for vision (Llama vision não suporta tool calling)
                            if "vision" not in g_model:
                                data_groq["tools"] = [
                                    {"type": "function", "function": {"name": "tool_executar_campanha", "description": "Orquestra uma campanha de marketing completa.", "parameters": {"type": "object", "properties": {"tema": {"type": "string"}}, "required": ["tema"]}}},
                                    {"type": "function", "function": {"name": "tool_salvar_memoria", "description": "Grave um facto para o futuro.", "parameters": {"type": "object", "properties": {"chave": {"type": "string"}, "valor": {"type": "string"}}, "required": ["chave", "valor"]}}},
                                    {"type": "function", "function": {"name": "tool_enviar_whatsapp", "description": "Envia msg WhatsApp.", "parameters": {"type": "object", "properties": {"numero": {"type": "string"}, "mensagem": {"type": "string"}}, "required": ["numero", "mensagem"]}}},
                                    {"type": "function", "function": {"name": "tool_gerar_imagem", "description": "Gera imagem IA (Pollinations) e opcionalmente envia ao WhatsApp.", "parameters": {"type": "object", "properties": {"prompt": {"type": "string", "description": "Descricao visual da imagem em ingles"}, "numero_whatsapp": {"type": "string", "description": "Numero WhatsApp para enviar (opcional)"}}, "required": ["prompt"]}}}
                                ]

                            gr_resp = requests.post("https://api.groq.com/openai/v1/chat/completions", json=data_groq, headers=headers, timeout=20)
                            
                            if gr_resp.status_code == 200:
                                resp_msg = gr_resp.json()['choices'][0]['message']
                                if resp_msg.get('tool_calls'):
                                    ms_groq.append(resp_msg) # Anexa a call da assistente q contém os tool calls
                                    for t in resp_msg['tool_calls']:
                                        fn = t['function']['name']
                                        args = json.loads(t['function']['arguments'])
                                        res_t = ""
                                        if fn == "tool_executar_campanha": res_t = tool_executar_campanha(args.get('tema',''))
                                        elif fn == "tool_salvar_memoria": res_t = tool_salvar_memoria(args.get('chave',''), args.get('valor',''))
                                        elif fn == "tool_enviar_whatsapp": res_t = tool_enviar_whatsapp(args.get('numero',''), args.get('mensagem',''))
                                        elif fn == "tool_gerar_imagem": res_t = tool_gerar_imagem(args.get('prompt',''), args.get('numero_whatsapp',''))
                                        else: res_t = "Erro ferramenta não encontrada"
                                        
                                        ms_groq.append({"role": "tool", "tool_call_id": t['id'], "name": fn, "content": str(res_t)})
                                    
                                    # Chamada secundária para colher a resposta com os dados das ferramentas
                                    data_groq = {"model": g_model, "messages": ms_groq, "temperature": 0.6}
                                    gr_resp2 = requests.post("https://api.groq.com/openai/v1/chat/completions", json=data_groq, headers=headers, timeout=20)
                                    final_text = gr_resp2.json()['choices'][0]['message']['content']
                                else:
                                    final_text = resp_msg.get('content', '')
                                break
                            else:
                                ultimo_erro = f"Groq {g_model}: {gr_resp.json().get('error', {}).get('message', 'Erro')}"
                        except Exception as e_gr:
                            ultimo_erro = f"Groq {g_model} Falha: {str(e_gr)}"; continue

                if not final_text:
                    final_text = f"⚠️ Diretor Kelvin, infelizmente estou com dificuldade técnica (Gemini e Groq). Último erro: {ultimo_erro[:150]}"

                set_cached_reply(user_msg, final_text)
                
                # Incluir imagem gerada na resposta se houver
                response_data = {'reply': final_text}
                if LAST_GENERATED_IMAGE:
                    response_data['image_base64'] = LAST_GENERATED_IMAGE
                    LAST_GENERATED_IMAGE = None  # Limpar após enviar
                
                reply(response_data)
            except Exception as e: reply({'error': str(e)}, 500)
            except Exception as e: reply({'error': str(e)}, 500)

if __name__ == '__main__':
    threading.Thread(target=monitorar_pedidos, daemon=True).start()
    port = int(os.environ.get("PORT", 10000))
    print(f"🚀 KSBOLD CÉREBRO na porta {port}")
    HTTPServer(('', port), HealthCheckHandler).serve_forever()
