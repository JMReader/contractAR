// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {MockARGt} from "../src/MockARGt.sol";
import {Escrow} from "../src/Escrow.sol";

/// Deploy local (Anvil) o Fuji autorizado. Escribe shared/addresses.json.
/// Anvil: forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
/// Fuji:  requiere PRIVATE_KEY (env, sólo testnet) + --rpc-url $FUJI_RPC --broadcast
contract Deploy is Script {
    // Cuenta #0 por defecto de Anvil — jamás usar fuera de desarrollo local.
    uint256 constant ANVIL_DEFAULT_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address constant ANVIL_DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    function run() external returns (MockARGt token, Escrow escrow) {
        uint256 key = vm.envOr("PRIVATE_KEY", ANVIL_DEFAULT_KEY);
        address treasury = vm.envOr("TREASURY", ANVIL_DEPLOYER);

        vm.startBroadcast(key);
        token = new MockARGt();
        escrow = new Escrow(address(token), treasury);
        vm.stopBroadcast();

        string memory json = "addresses";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "token", address(token));
        vm.serializeAddress(json, "escrow", address(escrow));
        vm.serializeAddress(json, "treasury", treasury);
        string memory out = vm.serializeUint(json, "deployedAt", block.timestamp);
        vm.writeJson(out, "../shared/addresses.json");
    }
}
