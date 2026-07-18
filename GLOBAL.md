Definição de pronto

Tarefa só está pronta se o agente rodou a verificação e reportou o resultado real — nunca "deve funcionar". Os comandos exatos (lint/teste/build) ficam no AGENTS.md de cada projeto; a regra de nunca declarar pronto sem rodar vale sempre, em qualquer stack.

Antes de editar

Releia o arquivo atual antes de editá-lo, mesmo que já tenha sido lido nesta sessão — pode ter mudado. Nunca edite de memória.

Pare e pergunte


Migração de schema, DROP ou DELETE em massa
Autenticação, assinatura de webhook, isolamento entre tenants/clientes
Dependência nova paga ou com permissão ampla
Merge em branch principal, deploy, bump de versão, release


Fora disso: ambiguidade barata e reversível → assuma a leitura mais convencional, declare a suposição, siga. Não pare pra confirmar o óbvio.

Nunca


Commitar segredo, chave de API ou credencial
Logar senha, token ou dado pessoal em texto plano
Reverter algo listado em "Erros já cometidos" do projeto sem sinalizar explicitamente que está revertendo


Loop de captura

Regra escrita antes do erro é teoria. Regra escrita depois do erro é a que se segue de fato. Todo review, bug ou correção que revelar uma suposição errada termina com uma linha nova em "Erros já cometidos" no AGENTS.md daquele projeto, na mesma sessão em que o erro foi visto — não depois, de memória.

Padrões

Nomenclatura, estrutura de pastas e tratamento de erro seguem o que já existe no repo — mudança de padrão é discussão própria, não vem junto de uma feature. Erro tratado de forma explícita, nunca engolido em silêncio.

Escala

Domínios claramente separados (backend/frontend, múltiplos clientes num monorepo) → AGENTS.md raiz curto + AGENTS.md por subpasta com o que é específico daquele domínio.

Tamanho

Acima de ~150 linhas por arquivo, ele para de ser lido com atenção — pelo agente e por você. Detalhe extenso vira doc referenciado, não conteúdo inline.