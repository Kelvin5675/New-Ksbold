import os
import json
import google.generativeai as genai

# Configuração do Gemini para a Agência de Marketing KSBOLD
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

class KSBoldMarketingAgency:
    def __init__(self, api_key):
        if api_key:
            genai.configure(api_key=api_key)
        self.model_name = 'gemini-1.5-flash' # Flash para agilidade em geração de textos/prompts
        self.model = genai.GenerativeModel(self.model_name)

    def agir_como_copywriter(self, briefing, snapshot):
        """O Agente especialista em persuasão e vendas."""
        prompt = f"""
        Você é o AGENTE COPYWRITER da KSBOLD.
        Sua especialidade: Escrever legendas magnéticas, scripts de Reels e textos de vendas que convertam curiosos em compradores.
        
        CONTEXTO KSBOLD: Decoração de luxo, quadros premium, Moçambique.
        DADOS REAIS: {snapshot}
        BRIEFING DO DIRETOR: {briefing}
        
        TAREFA: Crie 3 opções de legendas para Instagram e um roteiro curto para Reels (15s).
        TOM DE VOZ: Elegante, aspiracional, direto ao ponto. Use Emojis moderadamente.
        """
        response = self.model.generate_content(prompt)
        return response.text

    def agir_como_designer_prompt(self, briefing):
        """O Agente especialista em criar conceitos visuais (Prompts de Imagem)."""
        prompt = f"""
        Você é o AGENTE DESIGNER da KSBOLD.
        Sua especialidade: Criar conceitos visuais e prompts para geradores de imagem (IA).
        
        BRIEFING: {briefing}
        
        TAREFA: Descreva detalhadamente uma cena de luxo onde um quadro da KSBOLD (ex: moldura dourada, arte abstrata) está em destaque. 
        O objetivo é usar esta descrição para gerar uma foto publicitária perfeita.
        """
        response = self.model.generate_content(prompt)
        return response.text

    def orquestrar_campanha(self, tema, snapshot):
        """O Diretor coordena os dois agentes."""
        print(f"📣 Iniciando orquestração de campanha: {tema}")
        
        copy = self.agir_como_copywriter(f"Campanha focada em {tema}", snapshot)
        visual = self.agir_como_designer_prompt(f"Imagem que transmita a sensação de {tema}")
        
        campanha = {
            "tema": tema,
            "copy": copy,
            "visual_concept": visual,
            "status": "Pronto para Aprovação do CEO"
        }
        return campanha

# Exemplo de uso isolado (se rodar o script diretamente)
if __name__ == "__main__":
    test_agency = KSBoldMarketingAgency(GEMINI_API_KEY)
    # mock snapshot
    snap = "Pedidos: 120, Receita: 50.000 MT, Funil: Saudável"
    print(test_agency.orquestrar_campanha("Promoção Mês das Noivas", snap))
