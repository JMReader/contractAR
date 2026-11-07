// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MockARGt} from "../MockARGt.sol";

/// @notice Prepara una wallet de demo: mintea tARGt y aprueba el escrow.
/// @dev Variables de entorno:
///      - PRIVATE_KEY (obligatoria): wallet que firma y paga el gas.
///      - TOKEN_ADDRESS (obligatoria): direccion de MockARGt.
///      - ESCROW_ADDRESS (obligatoria): direccion de Escrow.
///      - DEMO_RECIPIENT (opcional): recibe el mint; por defecto el deployer.
///      - DEMO_MINT_AMOUNT (opcional): unidades minimas; por defecto 1.000.000e18.
contract FundDemo is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address recipient = vm.envOr("DEMO_RECIPIENT", deployer);
        MockARGt token = MockARGt(vm.envAddress("TOKEN_ADDRESS"));
        address escrow = vm.envAddress("ESCROW_ADDRESS");
        uint256 amount = vm.envOr("DEMO_MINT_AMOUNT", uint256(1_000_000e18));

        vm.startBroadcast(privateKey);

        token.mint(recipient, amount);
        IERC20(address(token)).approve(escrow, type(uint256).max);

        vm.stopBroadcast();

        console.log("Recipient:", recipient);
        console.log("Minted:", amount);
        console.log("Approved escrow:", escrow);
    }
}
