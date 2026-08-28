# Synapse — painel pessoal

Painel pessoal com dashboard, agenda (integrada ao Google), tarefas, hábitos, foco (pomodoro), notas, diário, flashcards de revisão, metas, gráficos de progresso, aba ENAMED, aba de treino e busca rápida (⌘K). Funciona como app instalável no celular (PWA). Os dados ficam salvos na nuvem (Firebase), sincronizados entre todos os seus dispositivos — você entra com sua conta Google pra acessar.

## 1. Hospedar de graça

**Netlify Drop (mais simples):**
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta `painel` inteira para a página
3. Você recebe um link público, tipo `https://algum-nome.netlify.app`

Guarde essa URL — você vai precisar dela nos passos seguintes.

*(Se você já conectou o projeto a um repositório no GitHub com publicação automática pelo Netlify, pode pular este passo — a URL já existe.)*

## 2. Criar login e banco de dados na nuvem (Firebase)

Isso faz os dados (tarefas, hábitos, treinos, etc.) ficarem salvos na nuvem em vez de só no navegador — sincronizados entre celular e computador. Usa o **Firebase**, do Google, no plano gratuito. Leva uns 10-15 minutos, só uma vez.

1. Acesse **console.firebase.google.com** → **Criar projeto** → dê um nome (ex: "Synapse Painel") → pode desativar o Google Analytics (não é necessário) → **Criar projeto**.
2. No menu lateral, vá em **Compilação → Authentication → Vamos começar**. Na aba "Sign-in method", clique em **Google** → ative → escolha um e-mail de suporte → **Salvar**.
3. Ainda em Authentication, vá na aba **Settings → Authorized domains** → **Add domain** → cole a URL do seu site (sem `https://`, só o domínio, ex: `algum-nome.netlify.app`).
4. No menu lateral, vá em **Compilação → Firestore Database → Criar banco de dados**. Escolha uma localização (ex: `southamerica-east1` para Brasil) → inicie em **modo de produção** → **Ativar**.
5. Na aba **Regras** do Firestore, substitua o conteúdo por:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
   Isso garante que cada pessoa só acessa os próprios dados. Clique em **Publicar**.
6. Volte para a **Visão geral do projeto** (ícone de casa) → clique no ícone **`</>`** (Web) para registrar um app → dê um apelido (ex: "Synapse") → **Registrar app**. Vai aparecer um bloco `firebaseConfig` com várias chaves — copie os valores.
7. Abra o arquivo `config.js` e cole os valores dentro de `FIREBASE_CONFIG`:
   ```js
   window.CONFIG = {
     GOOGLE_CLIENT_ID: '...',
     FIREBASE_CONFIG: {
       apiKey: 'cole aqui',
       authDomain: 'cole aqui',
       projectId: 'cole aqui',
       storageBucket: 'cole aqui',
       messagingSenderId: 'cole aqui',
       appId: 'cole aqui'
     }
   };
   ```
8. Publique a nova versão do site (arraste a pasta de novo no Netlify Drop, ou, se estiver usando GitHub + Netlify, basta a atualização chegar no repositório).
9. Abra o site → tela de login → **Entrar com Google** → escolha sua conta. Pronto — a partir daqui, tudo que você adicionar fica salvo na nuvem.

**Nota:** essas chaves do Firebase são públicas por natureza (não são senhas) — a segurança de verdade está nas regras do Firestore do passo 5, que garantem que só você acessa seus próprios dados.

**Se você já tinha dados salvos no navegador** (de antes dessa atualização), o site importa automaticamente pra nuvem na primeira vez que você entrar, contanto que use o mesmo navegador/dispositivo onde os dados estavam.

## 3. Conectar a Google Agenda (ler e criar eventos direto pelo site)

Isso usa a API oficial do Google, com sua própria conta — sem servidor, sem custo. Leva uns 10 minutos, só uma vez.

1. Acesse **console.cloud.google.com** e crie um projeto novo (ex: "Synapse Painel") — pode ser o mesmo projeto do Firebase, já que Firebase roda sobre o Google Cloud.
2. Vá em **APIs e serviços → Biblioteca**, procure **Google Calendar API** e clique em **Ativar**.
3. Vá em **APIs e serviços → Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**
   - Preencha nome do app ("Synapse"), seu e-mail de suporte e de contato
   - Em **Escopos**, adicione `https://www.googleapis.com/auth/calendar.events`
   - Em **Usuários de teste**, adicione seu próprio e-mail do Google (assim o app funciona sem precisar passar pela revisão do Google — é só para você)
4. Vá em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**
   - Em **Origens JavaScript autorizadas**, adicione a URL do seu site (ex: `https://algum-nome.netlify.app`)
   - Não precisa preencher "URIs de redirecionamento"
   - Clique em **Criar** e copie o **Client ID** gerado (termina com `.apps.googleusercontent.com`)
5. Cole o Client ID em `config.js`, no campo `GOOGLE_CLIENT_ID`.
6. Publique a nova versão do site.
7. Abra o site → aba **Agenda** → **Conectar Google Agenda** → escolha sua conta → aceite a permissão. Pronto: seus próximos eventos aparecem ali e no Painel, e o formulário "Novo evento" cria eventos direto na sua Google Agenda.

**Nota:** por estar em modo "Teste" na tela de consentimento, só as contas que você adicionar como "usuários de teste" conseguem conectar — perfeito para uso pessoal, sem precisar de revisão do Google.

## 4. Instalar como app no celular

- **Android (Chrome):** abra o site → menu (⋮) → "Adicionar à tela inicial"
- **iPhone (Safari):** abra o site → ícone de compartilhar → "Adicionar à Tela de Início"

## Atalhos e recursos

- **⌘K / Ctrl+K** — abre a busca rápida, encontra tarefas, notas, hábitos, metas, flashcards, treinos e conteúdos de estudo
- **Painel (dashboard)** — resumo do dia: tarefas pendentes, hábitos, próximos eventos, metas, última nota ENAMED e último treino, com botões de atalho para adicionar rapidamente
- Hábitos mostram um mini-histórico dos últimos 7 dias
- Tarefas podem ter prazo, com aviso visual quando está atrasada ou vence hoje

## Aba ENAMED (Estudos)

Duas partes, alternadas pelos botões no topo da aba:

- **Simulados** — registre nome, data e nota geral de cada simulado; opcionalmente adicione notas por área (ex: Clínica Médica, Cirurgia, Pediatria...) clicando em "+ Nota por área". Um gráfico mostra a evolução da nota geral ao longo dos simulados, e um resumo mostra sua última nota, média e melhor nota. Clique num simulado da lista para expandir o detalhamento por área.
- **Conteúdo programático** — organize por período (ex: "5º Semestre") e, dentro de cada período, por módulo (ex: "Cardiologia"). Dentro de cada módulo, adicione os conteúdos que vão cair na prova e marque como estudado conforme for revisando. Cada módulo e período mostra quantos itens já foram concluídos.

## Aba Treino

Cada treino vira um cartão expansível com data e nome (ex: "Peito e Tríceps"). Dentro dele, adicione exercícios com quantas séries quiser — cada série tem carga (kg) e repetições. Um gráfico no topo mostra a evolução de carga de um exercício específico ao longo do tempo (escolha o exercício no menu suspenso) — ótimo pra acompanhar progressão de carga.

## Estrutura dos arquivos
```
painel/
  index.html      → estrutura da página (inclui a tela de login)
  style.css        → visual (cores, tipografia, layout)
  app.js           → toda a lógica, autenticação e sincronização com o Firebase
  config.js        → onde você cola as chaves do Google e do Firebase (único arquivo a editar)
  manifest.json    → configuração do app instalável
  sw.js            → funcionamento offline
  icons/           → ícones do app
```

## Observações importantes

- Os dados agora ficam salvos na nuvem (Firestore), vinculados à sua conta Google — abrindo o site em qualquer dispositivo com a mesma conta, tudo aparece sincronizado.
- O plano gratuito do Firestore cobre bastante uso pessoal (50 mil leituras e 20 mil escritas por dia) — não deve chegar perto disso com um usuário só.
- A conexão com a Google Agenda (aba Agenda) precisa ser refeita de tempos em tempos (o token de acesso expira depois de 1 hora); é só clicar em "Reconectar". Isso é separado do login do Firebase, que permanece conectado.
