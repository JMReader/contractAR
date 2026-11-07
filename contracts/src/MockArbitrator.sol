// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Interfaz mínima del escrow para reenviar fallos.
interface IEscrowRule {
    function rule(uint256 id, uint256 toBeneficiary, uint256 toDepositor) external;
}

/// @title MockArbitrator — árbitro de demo estilo ERC-792 mínimo.
/// @notice Elección de diseño: el spec (02, D9) fija una *dirección* de árbitro
///         por acuerdo y `Escrow.rule` valida `msg.sender == arbiter`. Un EOA
///         como árbitro ya basta; este contrato existe para que la demo pueda
///         usar una entidad de arbitraje identificable onchain: el campo
///         `arbiter` del acuerdo se setea a esta dirección y el owner (clave
///         del operador de demo) reenvía fallos auditables. No promete
///         integración Kleros — sólo el par Dispute/Ruling de eventos.
/// @dev El escrow sigue siendo la autoridad: este contrato no custodia fondos
///      ni decide — sólo reenvía `rule` bajo `onlyOwner`.
contract MockArbitrator is Ownable {
    /// @param operator clave del operador de demo que firma los fallos.
    constructor(address operator) Ownable(operator) {}

    /// @notice Reenvía un fallo al escrow. El acuerdo debe tener
    ///         `arbiter == address(this)` para que el escrow lo acepte.
    /// @param escrow dirección del contrato Escrow.
    /// @param agreementId id del acuerdo en disputa.
    /// @param toBeneficiary porción del remaining para el beneficiario.
    /// @param toDepositor porción del remaining para el depositante.
    function rule(address escrow, uint256 agreementId, uint256 toBeneficiary, uint256 toDepositor) external onlyOwner {
        IEscrowRule(escrow).rule(agreementId, toBeneficiary, toDepositor);
    }
}
