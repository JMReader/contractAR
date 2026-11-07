// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    Escrow,
    SplitMismatch,
    DeadlinePassed,
    DeadlineNotPassed,
    NotAuthorized,
    NotDepositor,
    NotArbiter,
    AlreadySettled
} from "../src/Escrow.sol";
import {MockARGt} from "../src/MockARGt.sol";

/// @title EscrowFuzzTest — propiedades de conservación y permisos bajo fuzz (256 runs).
/// @dev M2: fee + neto + refund == depósito, en todo split y todo monto.
contract EscrowFuzzTest is Test {
    MockARGt internal token;
    Escrow internal escrow;

    address internal constant TREASURY = address(0x7EA5);
    address internal constant DEPOSITOR = address(0xDE90);
    address internal constant BENEFICIARY = address(0xBEEF);
    address internal constant ARBITER = address(0xA4B1);

    function setUp() public {
        token = new MockARGt(address(this));
        escrow = new Escrow(IERC20(address(token)), TREASURY);
    }

    /// @dev Crea, acepta y fondea un acuerdo de `deposit` con plazos holgados.
    function _funded(uint256 deposit, uint40 reviewDl) internal returns (uint256 id) {
        token.mint(DEPOSITOR, deposit);
        id = escrow.create(
            Escrow.Template.Guarantee,
            DEPOSITOR,
            BENEFICIARY,
            ARBITER,
            deposit,
            keccak256("fuzz"),
            uint40(block.timestamp + 1 days),
            reviewDl
        );
        vm.startPrank(DEPOSITOR);
        token.approve(address(escrow), deposit);
        escrow.accept(id);
        escrow.fund(id);
        vm.stopPrank();
    }

    /// Propiedad: acceptOutcome con cualquier claim válido conserva el depósito
    /// exactamente: fee + neto(beneficiario) + devolución(depositante) == depósito.
    /// _funded deja al depositante en 0 y ben/treasury arrancan en 0: los
    /// balances absolutos post-settle son el reparto exacto.
    function testFuzz_AcceptOutcome_Conservation(uint256 deposit, uint256 claim, bool depositorProposes) public {
        deposit = bound(deposit, 1, 1e27);
        uint256 id = _funded(deposit, uint40(block.timestamp + 7 days));
        claim = bound(claim, 0, deposit);

        (address proposer, address acceptor) = depositorProposes ? (DEPOSITOR, BENEFICIARY) : (BENEFICIARY, DEPOSITOR);
        vm.prank(proposer);
        escrow.proposeOutcome(id, claim);
        vm.prank(acceptor);
        escrow.acceptOutcome(id);

        uint256 fee = (claim * escrow.FEE_BPS()) / escrow.BPS_DENOMINATOR();
        assertEq(token.balanceOf(TREASURY), fee, "fee exacto a treasury");
        assertEq(token.balanceOf(BENEFICIARY), claim - fee, "neto = claim - fee");
        assertEq(token.balanceOf(DEPOSITOR), deposit - claim, "refund = deposit - claim");
        assertEq(token.balanceOf(address(escrow)), 0, "escrow queda vacio");
        assertLe(fee, claim, "fee <= porcion beneficiario");
        assertEq(uint8(escrow.agreements(id).state), uint8(Escrow.State.Settled));
        assertEq(escrow.agreements(id).remaining, 0);
    }

    /// Propiedad: rule con cualquier split que sume remaining conserva fondos.
    function testFuzz_Rule_Conservation(uint256 deposit, uint256 toB) public {
        deposit = bound(deposit, 1, 1e27);
        uint256 id = _funded(deposit, uint40(block.timestamp + 7 days));
        toB = bound(toB, 0, deposit);

        vm.prank(BENEFICIARY);
        escrow.dispute(id);
        vm.prank(ARBITER);
        escrow.rule(id, toB, deposit - toB);

        uint256 fee = (toB * escrow.FEE_BPS()) / escrow.BPS_DENOMINATOR();
        assertEq(token.balanceOf(TREASURY), fee, "fee exacto a treasury");
        assertEq(token.balanceOf(BENEFICIARY), toB - fee, "neto = toB - fee");
        assertEq(token.balanceOf(DEPOSITOR), deposit - toB, "refund = deposit - toB");
        assertEq(token.balanceOf(address(escrow)), 0, "escrow queda vacio");
        assertEq(fee + (toB - fee) + (deposit - toB), deposit, "fee+neto+refund = deposito");
    }

    /// Propiedad: rule con suma incorrecta SIEMPRE revierte SplitMismatch.
    function testFuzz_Rule_WrongSumReverts(uint256 deposit, uint256 toB, uint256 toD) public {
        deposit = bound(deposit, 1, 1e27);
        toB = bound(toB, 0, deposit);
        toD = bound(toD, 0, deposit);
        vm.assume(toB + toD != deposit); // excluir el único split válido

        uint256 id = _funded(deposit, uint40(block.timestamp + 7 days));
        vm.prank(DEPOSITOR);
        escrow.dispute(id);
        vm.prank(ARBITER);
        vm.expectRevert(SplitMismatch.selector);
        escrow.rule(id, toB, toD);
    }

    /// Propiedad: refundAfterTimeout devuelve siempre el depósito íntegro, fee 0.
    function testFuzz_Refund_AlwaysFullNoFee(uint256 deposit, uint256 warpDelta) public {
        deposit = bound(deposit, 1, 1e27);
        uint40 reviewDl = uint40(block.timestamp + 1); // deadline casi inmediato
        uint256 id = _funded(deposit, reviewDl);
        warpDelta = bound(warpDelta, 1, 365 days);
        vm.warp(reviewDl + uint40(warpDelta)); // cualquier tiempo posterior al deadline
        vm.prank(DEPOSITOR);
        escrow.refundAfterTimeout(id);
        assertEq(token.balanceOf(DEPOSITOR), deposit, "devolucion integra");
        assertEq(token.balanceOf(TREASURY), 0, "sin fee en devolucion");
        assertEq(token.balanceOf(address(escrow)), 0, "escrow queda vacio");
    }

    /// Propiedad: en o antes del deadline el refund SIEMPRE revierte.
    function testFuzz_Refund_BeforeDeadlineReverts(uint256 deposit, uint256 now_) public {
        deposit = bound(deposit, 1, 1e27);
        uint40 reviewDl = uint40(block.timestamp + 30 days);
        uint256 id = _funded(deposit, reviewDl);
        now_ = bound(now_, block.timestamp, reviewDl); // now <= deadline
        vm.warp(now_);
        vm.prank(DEPOSITOR);
        vm.expectRevert(DeadlineNotPassed.selector);
        escrow.refundAfterTimeout(id);
    }

    /// Propiedad: accept después del acceptDeadline SIEMPRE revierte; antes nunca.
    function testFuzz_Accept_DeadlineBoundary(uint256 deposit, uint256 now_) public {
        deposit = bound(deposit, 1, 1e27);
        token.mint(DEPOSITOR, deposit);
        uint40 acceptDl = uint40(vm.getBlockTimestamp() + 10 days);
        uint256 id = escrow.create(
            Escrow.Template.Guarantee,
            DEPOSITOR,
            BENEFICIARY,
            ARBITER,
            deposit,
            bytes32(0),
            acceptDl,
            uint40(block.timestamp + 30 days)
        );
        now_ = bound(now_, block.timestamp, uint256(acceptDl) + 10 days);
        vm.warp(now_);
        vm.prank(DEPOSITOR);
        if (now_ > acceptDl) {
            vm.expectRevert(DeadlinePassed.selector);
        }
        escrow.accept(id);
        if (now_ <= acceptDl) {
            assertEq(uint8(escrow.agreements(id).state), uint8(Escrow.State.Accepted));
        }
    }

    /// Propiedad: nadie fuera de las partes puede proponer, disputar ni resolver,
    /// con cualquier monto y en cualquier estado con fondos.
    function testFuzz_Permissions_StrangerCanDoNothing(uint256 deposit, uint256 claim, address rando) public {
        vm.assume(rando != DEPOSITOR && rando != BENEFICIARY && rando != ARBITER && rando != address(0));
        deposit = bound(deposit, 1, 1e27);
        uint256 id = _funded(deposit, uint40(block.timestamp + 7 days));

        vm.startPrank(rando);
        vm.expectRevert(NotAuthorized.selector);
        escrow.proposeOutcome(id, bound(claim, 0, deposit));
        vm.expectRevert(NotAuthorized.selector);
        escrow.dispute(id);
        vm.expectRevert(NotDepositor.selector);
        escrow.refundAfterTimeout(id);
        vm.stopPrank();

        vm.prank(DEPOSITOR);
        escrow.dispute(id);
        vm.prank(rando);
        vm.expectRevert(NotArbiter.selector);
        escrow.rule(id, deposit, 0);
    }

    /// Propiedad: cadena de re-propuestas alternadas siempre deja vigente la
    /// última, y la parte que no propuso es la única que puede aceptar.
    function testFuzz_Reproposal_PingPong(uint256 deposit, uint256[] calldata claims) public {
        deposit = bound(deposit, 1, 1e27);
        uint256 id = _funded(deposit, uint40(block.timestamp + 7 days));
        vm.assume(claims.length > 0 && claims.length < 64);

        address proposer = DEPOSITOR;
        uint256 last;
        for (uint256 i; i < claims.length; i++) {
            last = bound(claims[i], 0, deposit);
            vm.prank(proposer);
            escrow.proposeOutcome(id, last);
            proposer = proposer == DEPOSITOR ? BENEFICIARY : DEPOSITOR;
        }
        Escrow.Agreement memory a = escrow.agreements(id);
        assertEq(a.proposedToBeneficiary, last);
        assertEq(a.outcomeProposer, claims.length % 2 == 0 ? BENEFICIARY : DEPOSITOR);

        // El proponente no puede aceptar; la otra parte sí.
        address acceptor = a.outcomeProposer == DEPOSITOR ? BENEFICIARY : DEPOSITOR;
        vm.prank(a.outcomeProposer);
        vm.expectRevert(NotAuthorized.selector);
        escrow.acceptOutcome(id);
        vm.prank(acceptor);
        escrow.acceptOutcome(id);
        assertEq(uint8(escrow.agreements(id).state), uint8(Escrow.State.Settled));
    }

    /// Propiedad: el escrow nunca retiene residuo tras un settle y nunca paga
    /// dos veces el mismo acuerdo (segundo settle siempre revierte).
    function testFuzz_NoResidueNoDoubleSettle(uint256 deposit, uint256 claim) public {
        deposit = bound(deposit, 1, 1e27);
        uint256 id = _funded(deposit, uint40(block.timestamp + 7 days));
        claim = bound(claim, 0, deposit);

        vm.prank(BENEFICIARY);
        escrow.proposeOutcome(id, claim);
        vm.prank(DEPOSITOR);
        escrow.acceptOutcome(id);

        assertEq(token.balanceOf(address(escrow)), 0);
        vm.prank(ARBITER);
        vm.expectRevert(AlreadySettled.selector);
        escrow.rule(id, deposit, 0);
        vm.prank(DEPOSITOR);
        vm.expectRevert(AlreadySettled.selector);
        escrow.refundAfterTimeout(id);
    }
}
