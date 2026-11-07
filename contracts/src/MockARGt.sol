// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockARGt — token ERC-20 de demo para ContractAR (18 decimales).
/// @dev `mint` restringido al owner (operador de demo). Sólo testnet/local —
///      jamás implica fondos reales. `1 tARGt = 1 ARS` es convención de demo.
contract MockARGt is ERC20, Ownable {
    /// @param owner_ operador de demo autorizado a acuñar.
    constructor(address owner_) ERC20("Mock ARGt", "tARGt") Ownable(owner_) {}

    /// @notice Siempre 18 decimales (spec 03).
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /// @notice Acuña tokens de demo. Sólo el owner.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
