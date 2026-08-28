# Synapse — painel pessoal

Painel pessoal com dashboard, agenda (integrada ao Google), tarefas, hábitos, foco (pomodoro), notas, diário, flashcards de revisão, metas, gráficos de progresso, aba ENAMED, aba de treino e busca rápida (⌘K). Funciona como app instalável no celular (PWA). Os dados ficam salvos no navegador do dispositivo (localStorage) — sem login, sem servidor próprio.

## 1. Hospedar de graça

**Netlify (recomendado — via GitHub, publica sozinho a cada atualização):**
No Netlify → **Add new site → Import an existing project → GitHub** → selecione o repositório → deixe "Publish directory" vazio ou `.` → **Deploy site**.

**Netlify Drop (alternativa manual, sem GitHub):**
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta `painel` inteira para a página
3. Você recebe um link público, tipo `https://algum-nome.netlify.app`

## 2. Conectar a Google Agenda (ler e criar eventos direto pelo site)

Isso usa a API oficial do Google, com sua própria conta — sem servidor, sem custo. Leva uns 10 minutos, só uma vez.

1. Acesse **console.cloud.google.com** e crie (ou reaproveite) um projeto.
2. Vá em **APIs e serviços → Biblioteca**, procure **Google Calendar API** e clique em **Ativar**.
3. Vá em **APIs e serviços → Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**
   - Preencha nome do app ("Synapse"), seu e-mail de suporte e de contato
   - Em **Escopos**, adicione `https://www.googleapis.com/auth/calendar.events`
   - Em **Usuários de teste**, adicione seu próprio e-mail do Google
4. Vá em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**
   - Em **Origens JavaScript autorizadas**, adicione a URL do seu site
   - Clique em **Criar** e copie o **Client ID** gerado (termina com `.apps.googleusercontent.com`)
5. Cole o Client ID em `config.js`, no campo `GOOGLE_CLIENT_ID`.
6. Publique a nova versão do site.
7. Abra o site → aba **Agenda** → **Conectar Google Agenda** → escolha sua conta → aceite a permissão.

**Nota:** por estar em modo "Teste" na tela de consentimento, só as contas que você adicionar como "usuários de teste" conseguem conectar — perfeito para uso pessoal, sem precisar de revisão do Google.

## 3. Instalar como app no celular

- **Android (Chrome):** abra o site → menu (⋮) → "Adicionar à tela inicial"
- **iPhone (Safari):** abra o site → ícone de compartilhar → "Adicionar à Tela de Início"

## Atalhos e recursos

- **⌘K / Ctrl+K** — abre a busca rápida, encontra tarefas, notas, hábitos, metas, flashcards, treinos e conteúdos de estudo
- **Painel (dashboard)** — resumo do dia: tarefas pendentes, hábitos, próximos eventos, metas, última nota ENAMED e último treino, com botões de atalho para adicionar rapidamente
- Hábitos mostram um mini-histórico dos últimos 7 dias
- Tarefas podem ter prazo, com aviso visual quando está atrasada ou vence hoje

## Aba ENAMED (Estudos)

Duas partes, alternadas pelos botões no topo da aba:

- **Simulados** — registre nome, data e nota geral de cada simulado; opcionalmente adicione notas por área clicando em "+ Nota por área". Um gráfico mostra a evolução da nota geral, com última nota, média e melhor nota.
- **Conteúdo programático** — organize por período (ex: "5º Semestre") e, dentro de cada período, por módulo (ex: "Cardiologia"). Dentro de cada módulo, adicione os conteúdos que vão cair na prova e marque como estudado.

## Aba Treino

Cada treino vira um cartão expansível com data e nome. Dentro dele, adicione exercícios com quantas séries quiser — cada série tem carga (kg) e repetições. Um gráfico no topo mostra a evolução de carga de um exercício específico ao longo do tempo.

## Estrutura dos arquivos
```
painel/
  index.html      → estrutura da página
  style.css        → visual (cores, tipografia, layout)
  app.js           → toda a lógica e armazenamento local
  config.js        → onde você cola o Client ID da Google Agenda (único arquivo a editar)
  manifest.json    → configuração do app instalável
  sw.js            → funcionamento offline
  icons/           → ícones do app
```

## Observação importante

Os dados (tarefas, hábitos, notas, diário, treino, ENAMED, etc.) ficam salvos **no navegador do dispositivo que você usar** — não sincronizam entre celular e computador. Se abrir o site em outro aparelho ou navegador, é uma cópia separada, começando do zero.
