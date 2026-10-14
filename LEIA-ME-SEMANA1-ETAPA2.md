# Edge Sidebar Lite — Semana 1, Etapa 2 (prévia local)

Esta cópia é baseada no código **v0.3.1** enviado pelo usuário. Nenhuma alteração foi publicada no GitHub e não é uma nova Release.

## Correções implementadas

1. **Seletor de navegador:** corrige `browsers is not defined` em `chooseLinkDestination` e inclui teste que seleciona Vivaldi na simulação, além das validações de link pré-existentes.
2. **Configurações:** gravação serializada por fila, arquivo temporário seguido de renomeação atômica, backup da versão anterior válida em `config.json.bak`, restauração automática do backup íntegro quando o arquivo principal estiver corrompido. Quando AMBOS estão inválidos, a aplicação encerra sem substituí-los. Nunca armazena cookies no repositório.
3. **Áudio:** mostra badge 🔊 nos atalhos que estiverem produzindo áudio; protege a aba de mídia do descarte LRU ao alternar entre sites. O cache passa a comportar **3 abas comuns mais as abas com áudio protegido**. Após a mídia parar, concede 10 segundos de tolerância para buffering ou pausas breves e então retoma o descarte normal.
4. **Testes:** amplia testes de seleção de navegador, proteção contra descarte da aba de música, e leitura/restauração/gravações simultâneas de configurações.

## PENDENTE — sincronizar `package-lock.json`

O ZIP original continha `package.json` com Electron `44.7.1` e electron-builder `26.17.0`, mas `package-lock.json` ainda registra Electron `30.5.1` e electron-builder `24.13.3`. **Não alteramos o lockfile à mão**: o registro do npm não estava acessível no ambiente de preparação. As dependências precisam ser resolvidas corretamente em uma máquina com rede (o PC Windows do usuário).

No PowerShell do Windows, após extrair o projeto em uma pasta de teste:

```powershell
cd C:\Users\geanr\edge-sidebar-lite-teste
npm run lock:sync
npm run lock:verify
npm ci
npm run check
npm test
npm start
```

`npm run lock:sync` atualiza apenas o arquivo `package-lock.json` sem rodar scripts de instalação; `npm ci` instala as dependências declaradas. Se o npm exigir autorização para o script do Electron, aprove **apenas** o pacote necessário, após revisar a origem. Não rode `npm audit fix --force` sem avaliação.

Para atualizar uma pasta já existente, faça backup primeiro e substitua apenas os arquivos do patch, depois execute os comandos acima. **Não coloque `config.json` nem arquivos de sessão no repositório.** O Electron normalmente usa uma pasta separada em `%APPDATA%` para configurações e dados de login.

## Validação executada

- `npm run check`: passou (verificação sintática do processo principal, preload e renderer).
- `npm test`: passou (layout, AppBar simulado, navegador externo, armazenamento atômico, indicação de áudio e proteção do cache).
- `npm run lock:verify`: **falha esperada** até a sincronização do lockfile no Windows.
- Testes gráficos no Windows, vídeo/música real, instalador NSIS e troca de versão: **pendentes**.

## Cenário prioritário de teste manual

1. Abra YouTube (ou outro site compatível), dê play em música e confirme a presença do 🔊 no respectivo ícone.
2. Abra **cinco ou mais outros atalhos** e retorne ao site com música: a página NÃO deve ter sido recriada ou reiniciada pela política de descarte.
3. Pause a mídia e aguarde mais de 10 segundos; o ícone deve desaparecer, e a aba poderá ser descarregada quando o cache estiver cheio.
4. Cadastre sites, feche e reabra; verifique se os favoritos e a largura escolhida foram preservados.
5. Clique num link que solicite nova aba, selecione Vivaldi (se instalado) e confirme que abre corretamente.

**Limitações:** os eventos `audio-state-changed` e `media-paused` representam áudio real segundo o Electron. Alguns sites suspendem conteúdo em segundo plano por políticas próprias; a proteção de cache evita destruir a aba, mas não consegue obrigar esses sites a tocar som. Muitas abas com áudio em paralelo podem elevar o consumo de RAM. A compatibilidade do login Google externo permanece a mesma e não há transposição de cookies.

**Contexto:** Security Research & App Hardening, testes controlados e autorizados.
