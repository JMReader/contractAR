// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockARGt} from "../src/MockARGt.sol";

contract MockARGtTest is Test {
    MockARGt internal token;
    address internal constant OWNER = address(0x0B0);
    address internal constant ALICE = address(0xA11CE);

    function setUp() public {
        token = new MockARGt(OWNER);
    }

    function test_Metadata() public view {
        assertEq(token.name(), "Mock ARGt");
        assertEq(token.symbol(), "tARGt");
        assertEq(token.decimals(), 18);
    }

    function test_Mint_OnlyOwner() public {
        vm.prank(OWNER);
        token.mint(ALICE, 1_000 ether);
        assertEq(token.balanceOf(ALICE), 1_000 ether);
        assertEq(token.totalSupply(), 1_000 ether);
    }

    function test_Mint_RevertNonOwner() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        token.mint(ALICE, 1);
    }

    function test_ERC20Flow() public {
        vm.prank(OWNER);
        token.mint(ALICE, 10 ether);
        vm.prank(ALICE);
        token.transfer(address(0xB0B), 4 ether);
        assertEq(token.balanceOf(ALICE), 6 ether);
        assertEq(token.balanceOf(address(0xB0B)), 4 ether);
    }
}
