# 🎯 TikTok Live Auto Quiz (IA OpenRouter + Automação Vercel)

Sistema completo de **Live Interativa de Quiz Automático para TikTok** com design **Grid Branco + Contornos Pretos (Cores Invertidas)**, geração contínua de perguntas via **IA OpenRouter**, **Ranking Top 5** no canto superior direito e **detecção automática de chat e presentes** pronta para **Vercel + Supabase + OBS Studio**.

---

## ✨ Recursos

- 🎨 **Visual Clean de Alto Contraste (Cores Invertidas)**: Fundo branco quadriculado, pílula de cronômetro com arco circular progressivo, card `Top 5` no canto, alternativas `A | B | C | D` e legenda `"O que vale pro jogo?"`.
- 🤖 **IA OpenRouter Automática**: Gera perguntas inéditas, 4 alternativas embaralhadas e dicas inteligentes continuamente.
- 📡 **Automação de Chat & Presentes na Vercel**:
  - Quem comentar a alternativa certa (`A`, `B`, `C`, `D` ou o texto da opção) ganha **+1 ponto** no Ranking.
  - Detecta presentes automaticamente via `tiktok-live-connector` em rota SSE Serverless (`/api/tiktok-worker`) com reconexão automática quando a live inicia.
- 🎁 **Os 5 Poderes por Presentes Específicos**:
  1. 🌹 **Rosa** → Eliminar alternativa errada (`-1 Errada`)
  2. 🫰 **Coração** → Liberar dica da IA (`Ver Dica`)
  3. 🍩 **Rosquinha** → Mostrar resposta certa (`Resposta`)
  4. 👑 **Coroa** → Comprar ponto direto no placar (`+1 Ponto`)
  5. 🎉 **Confete** → Pular e gerar outra pergunta (`Pular Quiz`)

---

## 🎬 Como Usar na Live (OBS / TikTok Live Studio)

1. Acesse o painel principal da aplicação na Vercel (ou `http://localhost:3000`), digite seu `@usuario` do TikTok e clique em **Ativar Automação**.
2. No **OBS Studio** ou **TikTok Live Studio**, adicione uma fonte **Navegador (Browser Source)**:
   - **URL**: `https://SEU-PROJETO.vercel.app/overlay?user=SEU_USUARIO`
   - **Largura**: `1080` | **Altura**: `1920`
