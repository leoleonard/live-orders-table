export interface Instrument {
  symbol: string;
  contractType: number;
}

export interface ContractType {
  contractType: number;
  contractSize: number;
}
