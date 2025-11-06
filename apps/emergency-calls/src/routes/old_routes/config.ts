// modules/samu-calls/config.ts

// Configurações para o módulo samu-calls
export const config = {
  // Período padrão para análises
  periodos: {
    anosRetroativos: 10
  },
  
  // Categorização de desfechos
  desfechos: {
    validos: [
      "Atendimento Concluído com Êxito",
      "Removido por Particulares",
      "Removido pelos Bombeiros/CIODS",
      "Óbito no Local/Atendimento"
    ],
    invalidos: [
      "Sem Desfecho/Casa Fechada/Não há paciente",
      "Desistência da solicitação",
      "Recusa de Remoção",
      "Inválido/Duplicado/Cancelado/Trote",
      "Não necessita/Sem Condições Clínicas",
      "Outros Desfechos"
    ]
  },
  
  // Mapeamento de códigos para valores legíveis
  mapeamentos: {
    sexo: {
      'M': 'Masculino',
      'F': 'Feminino',
      'I': 'Ignorado',
      '': 'Não informado'
    },
    categoria: {
      'ACIDENTE DE TRANSITO': 'Acidente de Trânsito',
      'ACIDENTE MOTO': 'Acidente de Moto',
      'ATROPELAMENTO': 'Atropelamento',
      'CAPOTAMENTO': 'Capotamento',
      'COLISAO': 'Colisão',
      'QUEDA DE MOTO': 'Queda de Moto'
    },
    subtipo: {
      'ACIDENTMOTO': 'Acidente de Motocicleta',
      'ATROPELCARRO': 'Atropelamento por Carro',
      'ATROPELMOTO': 'Atropelamento por Moto',
      'CAPOTAMENTO': 'Capotamento',
      'COLISAO': 'Colisão',
      'QUEDAMOTO': 'Queda de Motocicleta'
    },
    motivoFinalizacao: {
      'TRANSPORTE REALIZADO': 'Transporte Realizado',
      'RECUSA DE TRANSPORTE': 'Recusa de Transporte',
      'OBITO NO LOCAL': 'Óbito no Local',
      'CANCELADO': 'Cancelado',
      'FALSO CHAMADO': 'Falso Chamado'
    },
    motivoDesfecho: {
      'ALTA HOSPITALAR': 'Alta Hospitalar',
      'INTERNACAO': 'Internação',
      'OBITO': 'Óbito',
      'TRANSFERENCIA': 'Transferência',
      'EVASAO': 'Evasão'
    },
    faixasEtarias: [
      { min: 0, max: 4, label: '0 a 4 anos' },
      { min: 5, max: 9, label: '5 a 9 anos' },
      { min: 10, max: 14, label: '10 a 14 anos' },
      { min: 15, max: 19, label: '15 a 19 anos' },
      { min: 20, max: 29, label: '20 a 29 anos' },
      { min: 30, max: 39, label: '30 a 39 anos' },
      { min: 40, max: 49, label: '40 a 49 anos' },
      { min: 50, max: 59, label: '50 a 59 anos' },
      { min: 60, max: 69, label: '60 a 69 anos' },
      { min: 70, max: 79, label: '70 a 79 anos' },
      { min: 80, max: 999, label: '80 anos ou mais' }
    ]
  }
};