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
- Produto sem frete exposto pode aparecer, mas precisa avisar o usuario e ser tratado como custo total incompleto.
- Erros de provedor devem ser tratados explicitamente, sem expor tokens, chaves ou dados pessoais.

## Erros ja cometidos

- `node --test tests` tenta executar a pasta `tests` como arquivo neste ambiente; usar `node --test`.
- Em handlers HTTP async, retornar Promise sem `await` dentro de `try/catch` deixa erro esperado virar rejeicao nao capturada; usar `return await`.
- Ao alterar `try/catch`, conferir sintaxe antes de seguir; `catch` duplicado em `searchService.js` quebrou o parse.
- Este PowerShell nao aceita `Invoke-WebRequest -SkipHttpErrorCheck`; para validar erro HTTP esperado, usar `try/catch`.
- Ao adicionar enriquecimento apos montar objeto de oferta, nao retornar o objeto antes do enriquecimento; criar `const offer`, aplicar campos extras e so entao retornar.
- Ao revalidar candidato web, exigir `productUrl` exato; evidencia antiga apontando para a URL original nao valida candidato retornado com outro link de produto.
- Se `npm.cmd run dev` falhar com `EADDRINUSE` na porta 3000, usar `PORT` alternativo para smoke test local e reportar a porta usada.
- Em erro de busca, nao tratar todo `SERVICE_UNAVAILABLE` como falta de chave/configuracao; distinguir rate limit, timeout, indisponibilidade e configuracao ausente.
- Arquivos `*-current.*.log` podem ficar bloqueados por processo de dev; eles sao ignorados pelo Git, entao nao forcar limpeza se o Windows negar acesso.
