# Categorizando Requisitos

## Requisitos de Cadastro
RC01 - O sistema deve ter cadastro e login de usuario
RC02 - Os cadastros do sistema são dividos em 3 tipos: Suporte, desenvolvedor, solicitante
RC03 - O suporte se cadastra normalmente.
RC04 - O desenvolvedor se cadastra normalmente
RC05 - O Solicitante só pode efetuar seu cadastro com um codigo fornecido pelo suporte.
RC06 - O Solicitante tambem deve informar sua cidade no cadastro
RC07 - Os usuarios do sistema devem conseguir visualizar seus proprios perfis

## Requisitos de Permissões
RP01 - O sistema deve permitir o suporte criar grupos
RP02 - O sistema deve permitir o suporte convidar usuarios para o grupo
RP03 - Grupos servirão para distinguir informações do sistema
RP04 - Cada grupo possui seu proprio "organismo" - Ou seja, se o usuario acessa o sistema sem estar em um grupo, ele não vê nada, além de seu perfil e configurações pessoais.
RP05 - Usuarios do grupo, com exceção do solicitante, devem conseguir visualizar todos os integrantes do grupo
RP06 - O usuario desenvolvedor deve ser capaz de aceitar ou recusar convites de grupos
RP07 - Para os técnicos: Suporte e Desenvolvedor, o grupo deve permiti-los realizarem criações, exclusões e edições.
RP08 - Informações do grupo são extritamente restritas a apenas aquele grupo, ou seja, os grupos são distintos em informações.
RP09 - O cadastro do grupo tem apenas o campo Nome do grupo e Descrição
RP10 - Suporte e desenvolvedor podem participar de varios grupos diferentes
RP11 - O usuario deve conseguir alternar entre seus grupos, mudando assim as informações que ele vê.
RP12 - O usuario, com exceção do solicitante, deve conseguir sair de um grupo se quiser
RP13 - Apenas suporte pode apagar um grupo, depois de passar por varias mensagens de aviso.
RP14 - No grupo, o suporte deve conseguir criar Categorias do usuario Desenvolvedor. Para que seja possivel definir se aquele usuario faz parte de Desenvolvimento web, desktop, etc...
RP15 - O desenvolvedor deve conseguir escolher qual categoria ele pertence. O suporte deve conseguir atribuir tambem aos desenvolvedores
RP16 - O sistema deve fornecer um log de auditoria de cada movimentação realizada no grupo.
RP17 - Usuario suporte deve conseguir visualizar todos os tickets dos grupos que pertence, deve conseguir criar filtros para buscar tickets, deve tambem conseguir visualizar seus proprios tickets
RP18 - O usuario desenvolvedor deve conseguir visualizar seus tickets atribuidos, tickets de sua categoria, tickets sem atribuição
RP19 - O usuario solicitante deve conseguir visualizar seus proprios tickets criados e todos os tickets da cidade onde ele pertence.
RP20 - Suporte e Desenvolvedor podem marcar tickets como concluido.

## Requisitos de Conteudo do sistema
RCS01 - O sistema deve permitir a criação de tickets
RCS02 - O sistema deve permitir a interação por mensagem entre os tecnicos do grupo - Chat geral
RCS03 - O sistema deve possuir um chat interno em cada ticket.
RCS04 - O sistema deve permitir a criação de serviços para automatizar criação de tickets
RCS05 - O sistema deve permitir que o solicitante envie um alerta de pedido de urgencia no ticket.
RCS06 - O sistema deve permitir criação de tickets sem atribuição, Tickets sem atribuição devem aparecer para todos os devs, em uma página especifica para isso (tipo dashboard);
RCS07 - O sistema deve fazer com que serviços sejam uma forma de padronizar criação de tickets, Exemplo: Criar um serviço para ticket de website - Padroniza a categoria do dev, padroniza as atribuições, também deve ser possivel padronizar o titulo, e criar mais de um serviço para um mesmo tipo de ticket website - Onde tem ticket para erro, ticket para melhoria, ticket para ajustes em configurações.
RCS08 - O sistema deve permitir marcar ticket para "Analise" Assim o solicitante recebe-o de volta e verifica se foi feito, caso não, marca como rejeitado e volta para o desenvolvedor.
RCS09 - O sistema deve ter uma visualização dos usuarios que mais criam solicitações, com filtros por cidade, etc...
RCS10 - O sistema deve ter uma especie de gamificação para os devs, onde em seus perfis do grupo, mostra a quantidade de tickets finalizados, quantidade de tickets atribuidos, quanto mais finaliza mais xp ganha.
RCS11 - O sistema deve mostrar no perfil do suporte do respectivo grupo, a quantidade de chamados atendidos por dia e no total.
RCS12 - O sistema deve ter uma página ou algo do tipo para permitir o cadastro de chamados feito pelo suporte. Isso é especifico para o suporte, por exemplo: Suporte atendeu cliente cm itajuba, ele deve ser capaz de registrar isso. Cada chamado é registrado.

