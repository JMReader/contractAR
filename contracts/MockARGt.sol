// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockARGt
/// @notice Token ERC-20 de prueba para la demo de ContractAR en Avalanche Fuji.
/// @dev No tiene valor economico ni respaldo. El mint es abierto a proposito para
///      poder fondear wallets de demo; nunca usar este contrato en mainnet.
contract MockARGt is ERC20 {
    constructor() ERC20("tARGt", "tARGt") {}

    /// @notice Decimales fijos de la demo (18).
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /// @notice Mintea tokens de prueba. Abierto solo para la demo.
    /// @param to Direccion que recibe los tokens.
    /// @param amount Cantidad en unidades minimas (18 decimales).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
