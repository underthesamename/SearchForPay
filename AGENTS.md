# SearchForPay - Regras locais

## Comandos

- Verificacao obrigatoria antes de declarar pronto: `npm.cmd run check`
- Rodar a ferramenta localmente: `npm.cmd run dev`

## Regra global obrigatoria

- Sempre aplicar as regras de `GLOBAL.md` em todas as tarefas deste projeto.
- Antes de editar qualquer arquivo, reler `GLOBAL.md` e o arquivo que sera editado.
- Se houver conflito entre uma regra local e `GLOBAL.md`, seguir a regra mais restritiva e registrar a decisao.

## Principios do projeto

- Nunca usar ofertas, lojas, precos, fretes ou impostos ficticios.
- Toda oferta exibida ao usuario precisa vir de provedor real configurado.
- Quando nao houver provedor real configurado, a API deve falhar de forma clara.
- Frete e imposto fazem parte do custo total, nao sao detalhe opcional.
- Erros de provedor devem ser tratados explicitamente, sem expor tokens, chaves ou dados pessoais.

## Erros ja cometidos

- `node --test tests` tenta executar a pasta `tests` como arquivo neste ambiente; usar `node --test`.
- Em handlers HTTP async, retornar Promise sem `await` dentro de `try/catch` deixa erro esperado virar rejeicao nao capturada; usar `return await`.
- Ao alterar `try/catch`, conferir sintaxe antes de seguir; `catch` duplicado em `searchService.js` quebrou o parse.
- Este PowerShell nao aceita `Invoke-WebRequest -SkipHttpErrorCheck`; para validar erro HTTP esperado, usar `try/catch`.
