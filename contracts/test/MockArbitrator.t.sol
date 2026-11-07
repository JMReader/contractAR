// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Escrow} from "../src/Escrow.sol";
import {MockARGt} from "../src/MockARGt.sol";
import {MockArbitrator} from "../src/MockArbitrator.sol";
import {NotArbiter, InvalidState} from "../src/Escrow.sol";

/// @title MockArbitratorTest — el árbitro-contrato reenvía fallos sólo vía owner.
contract MockArbitratorTest is Test {
    event Ruling(uint256 indexed disputeId, uint8 ruling);
    event Settled(uint256 indexed id, uint256 toBeneficiary, uint256 fee, uint256 toDepositor);

    MockARGt internal token;
    Escrow internal escrow;
    MockArbitrator internal mockArb;

    address internal constant TREASURY = address(0x7EA5);
    address internal constant OPERATOR = address(0x0E9A); // owner del árbitro
    address internal constant DEPOSITOR = address(0xDE90);
    address internal constant BENEFICIARY = address(0xBEEF);
    address internal constant STRANGER = address(0xBAD);

    uint256 internal constant DEPOSIT = 100_000 ether;

    uint256 internal id;

    function setUp() public {
        token = new MockARGt(address(this));
        escrow = new Escrow(IERC20(address(token)), TREASURY);
        mockArb = new MockArbitrator(OPERATOR);

        // Acuerdo cuyo árbitro es el CONTRATO MockArbitrator.
        id = escrow.create(
            Escrow.Template.Guarantee,
            DEPOSITOR,
            BENEFICIARY,
            address(mockArb),
            DEPOSIT,
            keccak256("t"),
            uint40(block.timestamp + 1 days),
            uint40(block.timestamp + 7 days)
        );
        token.mint(DEPOSITOR, DEPOSIT);
        vm.startPrank(DEPOSITOR);
        token.approve(address(escrow), DEPOSIT);
        escrow.accept(id);
        escrow.fund(id);
        escrow.dispute(id);
        vm.stopPrank();
    }

    function test_OwnerRulesThroughMock() public {
        uint256 toB = 40_000 ether;
        uint256 toD = DEPOSIT - toB;
        uint256 depBefore = token.balanceOf(DEPOSITOR);

        vm.expectEmit(true, false, false, true);
        emit Ruling(1, 2);
        vm.expectEmit(true, false, false, true);
        emit Settled(id, toB, toB / 100, toD);
        vm.prank(OPERATOR);
        mockArb.rule(address(escrow), id, toB, toD);

        assertEq(uint8(escrow.agreements(id).state), uint8(Escrow.State.Settled));
        assertEq(token.balanceOf(BENEFICIARY), toB - toB / 100);
        assertEq(token.balanceOf(TREASURY), toB / 100);
        assertEq(token.balanceOf(DEPOSITOR) - depBefore, toD);
    }

    function test_RuleThroughMock_RevertNonOwner() public {
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, STRANGER));
        mockArb.rule(address(escrow), id, DEPOSIT, 0);
    }

    function test_DirectRuleReverts_ArbiterIsContract() public {
        // Ni el owner ni las partes pueden llamar Escrow.rule directamente
        // cuando `arbiter` es el contrato: el llamador debe SER el árbitro.
        vm.prank(OPERATOR);
        vm.expectRevert(NotArbiter.selector);
        escrow.rule(id, DEPOSIT, 0);
        vm.prank(DEPOSITOR);
        vm.expectRevert(NotArbiter.selector);
        escrow.rule(id, DEPOSIT, 0);
    }

    function test_RuleThroughMock_RevertWrongState() public {
        // El forwarder propaga el revert del escrow (acuerdo sin disputa).
        vm.prank(OPERATOR);
        mockArb.rule(address(escrow), id, DEPOSIT, 0); // resuelve
        vm.prank(OPERATOR);
        vm.expectRevert(); // segundo intento: AlreadySettled del escrow
        mockArb.rule(address(escrow), id, DEPOSIT, 0);
    }
}
