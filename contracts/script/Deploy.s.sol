// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {MockARGt} from "../src/MockARGt.sol";
import {Escrow} from "../src/Escrow.sol";
import {MockArbitrator} from "../src/MockArbitrator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Deploy local (Anvil) o Fuji autorizado.
/// Con la clave por defecto de Anvil escribe shared/addresses.local.json; con
/// PRIVATE_KEY explícita (deploy real) escribe shared/addresses.json — ese
/// archivo es la autoridad de las direcciones Fuji y no se pisa en local.
/// Anvil: forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
/// Fuji:  requiere PRIVATE_KEY (env, sólo testnet) + --rpc-url $FUJI_RPC --broadcast
contract Deploy is Script {
    // Cuenta #0 por defecto de Anvil — jamás usar fuera de desarrollo local.
    uint256 constant ANVIL_DEFAULT_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external returns (MockARGt token, Escrow escrow, MockArbitrator arbitrator) {
        uint256 key = vm.envOr("PRIVATE_KEY", ANVIL_DEFAULT_KEY);
        address deployer = vm.addr(key);
        address treasury = vm.envOr("TREASURY", deployer);
        // El árbitro mock tiene como owner/operador la cuenta que firma los fallos.
        address arbiterOperator = vm.envOr("ARBITER_OPERATOR", deployer);

        vm.startBroadcast(key);
        token = new MockARGt(deployer);
        escrow = new Escrow(token, treasury);
        arbitrator = new MockArbitrator(arbiterOperator);
        vm.stopBroadcast();

        string memory json = "addresses";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "token", address(token));
        vm.serializeAddress(json, "escrow", address(escrow));
        vm.serializeAddress(json, "arbitrator", address(arbitrator));
        vm.serializeAddress(json, "treasury", treasury);
        string memory out = vm.serializeUint(json, "deployedAt", block.timestamp);
        vm.writeJson(out, key == ANVIL_DEFAULT_KEY ? "../shared/addresses.local.json" : "../shared/addresses.json");
    }
}
