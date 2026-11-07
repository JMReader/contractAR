// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Escrow} from "../src/Escrow.sol";
import {MockARGt} from "../src/MockARGt.sol";

/// @title EscrowHandler — actor acotado para corridas de invariantes.
/// @dev `fail_on_revert = true` en foundry.toml: TODA llamada externa va en
///      try/catch y los inputs se acotan a rangos válidos. Las acciones
///      chequean el estado real del acuerdo para elegir llamador y monto,
///      por lo que cada paso explora sólo transiciones potencialmente válidas.
///      Variables fantasma: ghostFunded / ghostReleased para conservación.
contract EscrowHandler is Test {
    Escrow public immutable escrow;
    MockARGt public immutable token;

    address public immutable creator;
    address public immutable depositor;
    address public immutable beneficiary;
    address public immutable arbiter;

    uint256[] internal ids;
    uint256 public ghostFunded; // Σ depósitos efectivamente fondeados
    uint256 public ghostReleased; // Σ remaining efectivamente distribuido en settles

    constructor(Escrow escrow_, MockARGt token_, address creator_, address depositor_, address beneficiary_, address arbiter_) {
        escrow = escrow_;
        token = token_;
        creator = creator_;
        depositor = depositor_;
        beneficiary = beneficiary_;
        arbiter = arbiter_;
    }

    function _pick(uint256 seed) internal view returns (uint256 id, bool ok) {
        if (ids.length == 0) return (0, false);
        return (ids[seed % ids.length], true);
    }

    /// Crea acuerdos con depósito y plazos acotados; el creador fijo es CREATOR.
    function create(uint256 depositSeed, uint256 dlSeed) external {
        uint256 deposit = bound(depositSeed, 1, 1e24);
        uint40 acceptDl = uint40(bound(dlSeed, block.timestamp, block.timestamp + 3 days));
        uint40 reviewDl = uint40(bound(dlSeed >> 32, block.timestamp, block.timestamp + 30 days));
        vm.prank(creator);
        try escrow.create(Escrow.Template.Guarantee, depositor, beneficiary, arbiter, deposit, keccak256("inv"), acceptDl, reviewDl)
        returns (uint256 id) {
            ids.push(id);
        } catch {}
    }

    function accept(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        Escrow.Agreement memory a = escrow.agreements(id);
        if (a.state != Escrow.State.Created) return;
        if (block.timestamp > a.acceptDeadline) return; // sólo transición válida
        vm.prank(depositor);
        try escrow.accept(id) {} catch {}
    }

    function cancel(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        Escrow.Agreement memory a = escrow.agreements(id);
        if (a.state != Escrow.State.Created && a.state != Escrow.State.Accepted) return;
        vm.prank(creator);
        try escrow.cancel(id) {} catch {}
    }

    function cancelExpired(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        Escrow.Agreement memory a = escrow.agreements(id);
        if (a.state != Escrow.State.Created) return;
        if (block.timestamp <= a.acceptDeadline) return;
        address caller = seed % 2 == 0 ? creator : depositor;
        vm.prank(caller);
        try escrow.cancelExpired(id) {} catch {}
    }

    function fund(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        Escrow.Agreement memory a = escrow.agreements(id);
        if (a.state != Escrow.State.Accepted) return;
        if (token.balanceOf(depositor) < a.deposit) return; // pre-chequeo como el contrato
        vm.prank(depositor);
        try escrow.fund(id) {
            ghostFunded += a.deposit;
        } catch {}
    }

    function proposeOutcome(uint256 seed, uint256 amountSeed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        Escrow.Agreement memory a = escrow.agreements(id);
        if (a.state != Escrow.State.Funded && a.state != Escrow.State.OutcomeProposed) return;
        address caller;
        if (a.state == Escrow.State.OutcomeProposed) {
            caller = a.outcomeProposer == depositor ? beneficiary : depositor; // re-propone la OTRA parte
        } else {
            caller = seed % 2 == 0 ? depositor : beneficiary;
        }
        uint256 toB = bound(amountSeed, 0, a.remaining);
        vm.prank(caller);
        try escrow.proposeOutcome(id, toB) {} catch {}
    }

    function acceptOutcome(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        Escrow.Agreement memory a = escrow.agreements(id);
        if (a.state != Escrow.State.OutcomeProposed) return;
        address caller = a.outcomeProposer == depositor ? beneficiary : depositor;
        uint256 remBefore = a.remaining;
        vm.prank(caller);
        try escrow.acceptOutcome(id) {
            ghostReleased += remBefore;
        } catch {}
    }

    function dispute(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        Escrow.Agreement memory a = escrow.agreements(id);
        if (a.state != Escrow.State.Funded && a.state != Escrow.State.OutcomeProposed) return;
        address caller = seed % 2 == 0 ? depositor : beneficiary;
        vm.prank(caller);
        try escrow.dispute(id) {} catch {}
    }

    function rule(uint256 seed, uint256 splitSeed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        Escrow.Agreement memory a = escrow.agreements(id);
        if (a.state != Escrow.State.Disputed) return;
        uint256 remBefore = a.remaining;
        uint256 toB = bound(splitSeed, 0, remBefore);
        uint256 toD = remBefore - toB; // suma exacta: única forma válida
        vm.prank(arbiter);
        try escrow.rule(id, toB, toD) {
            ghostReleased += remBefore;
        } catch {}
    }

    function refundAfterTimeout(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        Escrow.Agreement memory a = escrow.agreements(id);
        if (a.state != Escrow.State.Funded && a.state != Escrow.State.OutcomeProposed) return;
        if (block.timestamp <= a.reviewDeadline) return;
        uint256 remBefore = a.remaining;
        vm.prank(depositor);
        try escrow.refundAfterTimeout(id) {
            ghostReleased += remBefore;
        } catch {}
    }

    /// Avanza el tiempo para explorar bordes temporales.
    function warp(uint256 secondsSeed) external {
        vm.warp(block.timestamp + bound(secondsSeed, 0, 45 days));
    }
}

/// @title EscrowInvariantTest — invariantes de fondos del spec (sección Invariantes).
/// @dev 64 runs × depth 16 con fail_on_revert activo.
contract EscrowInvariantTest is Test {
    MockARGt internal token;
    Escrow internal escrow;
    EscrowHandler internal handler;

    address internal constant TREASURY = address(0x7EA5);
    address internal constant CREATOR = address(0xC1EA7);
    address internal constant DEPOSITOR = address(0xDE90);
    address internal constant BENEFICIARY = address(0xBEEF);
    address internal constant ARBITER = address(0xA4B1);

    function setUp() public {
        token = new MockARGt(address(this));
        escrow = new Escrow(IERC20(address(token)), TREASURY);
        handler = new EscrowHandler(escrow, token, CREATOR, DEPOSITOR, BENEFICIARY, ARBITER);
        token.mint(DEPOSITOR, 1e40); // alcanza para cualquier corrida de 16 pasos
        vm.prank(DEPOSITOR);
        token.approve(address(escrow), type(uint256).max);

        bytes4[] memory all = new bytes4[](11);
        all[0] = EscrowHandler.create.selector;
        all[1] = EscrowHandler.accept.selector;
        all[2] = EscrowHandler.cancel.selector;
        all[3] = EscrowHandler.cancelExpired.selector;
        all[4] = EscrowHandler.fund.selector;
        all[5] = EscrowHandler.proposeOutcome.selector;
        all[6] = EscrowHandler.acceptOutcome.selector;
        all[7] = EscrowHandler.dispute.selector;
        all[8] = EscrowHandler.rule.selector;
        all[9] = EscrowHandler.refundAfterTimeout.selector;
        all[10] = EscrowHandler.warp.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: all}));
        targetContract(address(handler));
    }

    /// Invariante 1: el balance custodiado cubre SIEMPRE la suma de `remaining`
    /// de acuerdos vivos (de hecho es exacto: nadie dona al escrow).
    function invariant_BalanceCoversRemaining() public view {
        uint256 n = escrow.agreementCount();
        uint256 sumRemaining;
        for (uint256 i = 1; i <= n; i++) {
            sumRemaining += escrow.agreements(i).remaining;
        }
        assertGe(token.balanceOf(address(escrow)), sumRemaining);
        assertEq(token.balanceOf(address(escrow)), sumRemaining);
    }

    /// Invariante 2 (M2): conservación exacta — lo que entró por `fund` es lo
    /// que quedó custodiado más lo que salió por settles.
    function invariant_Conservation() public view {
        assertEq(token.balanceOf(address(escrow)) + handler.ghostReleased(), handler.ghostFunded());
    }

    /// Invariante 3: estado terminal ⇒ remaining 0; remaining nunca supera
    /// el depósito (sin sobre-liberación).
    function invariant_TerminalZeroRemainingAndBounded() public view {
        uint256 n = escrow.agreementCount();
        for (uint256 i = 1; i <= n; i++) {
            Escrow.Agreement memory a = escrow.agreements(i);
            if (a.state == Escrow.State.Settled || a.state == Escrow.State.Cancelled) {
                assertEq(a.remaining, 0);
            }
            assertLe(a.remaining, a.deposit);
        }
    }

}
