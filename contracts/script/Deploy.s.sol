// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {Escrow} from "../Escrow.sol";
import {MockARGt} from "../MockARGt.sol";

/// @notice Despliega MockARGt y Escrow en Avalanche Fuji.
/// @dev Variables de entorno:
///      - PRIVATE_KEY (obligatoria): clave de la wallet de demo, nunca commitear.
///      - TREASURY_ADDRESS (opcional): tesoreria; por defecto el deployer.
///      - ARBITER_ADDRESS (opcional): arbitro mock; por defecto el deployer.
contract Deploy is Script {
    function run() external returns (MockARGt token, Escrow escrow) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address arbiter = vm.envOr("ARBITER_ADDRESS", deployer);

        vm.startBroadcast(privateKey);

        token = new MockARGt();
        escrow = new Escrow(arbiter, treasury);

        vm.stopBroadcast();

        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("Arbiter:", arbiter);
        console.log("MockARGt:", address(token));
        console.log("Escrow:", address(escrow));
    }
}
