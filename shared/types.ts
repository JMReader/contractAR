export type Address = `0x${string}`;
export type Bytes32 = `0x${string}`;

/** Estados onchain del Escrow. Los valores numericos deben coincidir con el enum Solidity. */
export enum State {
  None = 0,
  Created = 1,
  Accepted = 2,
  Funded = 3,
  Delivered = 4,
  Completed = 5,
  Refunded = 6,
  Settled = 7,
  Disputed = 8,
  Cancelled = 9,
}

/** Roles que participan en un acuerdo. */
export type PartyRole = "payer" | "payee" | "arbiter" | "treasury";

export interface Party {
  address: Address;
  role: PartyRole;
}

/** Espejo de Escrow.Agreement. Los montos son unidades minimas del token (bigint). */
export interface Agreement {
  id: bigint;
  payer: Address;
  payee: Address;
  token: Address;
  amount: bigint;
  feeBps: number;
  deadline: bigint;
  conditionsHash: Bytes32;
  state: State;
  tokenDecimals: number;
}

/** Acciones que la wallet conectada puede ejecutar sobre un acuerdo. */
export interface ActionAvailability {
  viewer: Address;
  canAccept: boolean;
  canFund: boolean;
  canMarkDelivered: boolean;
  canRelease: boolean;
  canRefund: boolean;
  canDispute: boolean;
  canCancel: boolean;
  canSettle: boolean;
}
