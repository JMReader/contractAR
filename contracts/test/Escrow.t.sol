// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Escrow} from "../src/Escrow.sol";
import {MockARGt} from "../src/MockARGt.sol";

// Errores declarados a nivel archivo en Escrow.sol — se importan por nombre.
import {
    NotAuthorized,
    InvalidState,
    NotDepositor,
    NotArbiter,
    AlreadySettled,
    WrongAmount,
    SplitMismatch,
    DeadlinePassed,
    DeadlineNotPassed,
    InsufficientBalance,
    InsufficientAllowance,
    ZeroAddress
} from "../src/Escrow.sol";

/// @title EscrowTest — tests unitarios por transición, permiso y borde temporal.
/// @dev Cubre M2 (conservación exacta) y M3 (autorización) de la matriz.
contract EscrowTest is Test {
    // Redeclaración de eventos para expectEmit.
    event AgreementCreated(
        uint256 indexed id,
        Escrow.Template template,
        address depositor,
        address beneficiary,
        uint256 deposit,
        bytes32 termsHash
    );
    event Accepted(uint256 indexed id);
    event Funded(uint256 indexed id, uint256 amount);
    event OutcomeProposed(uint256 indexed id, address proposer, uint256 toBeneficiary);
    event Dispute(uint256 indexed id, uint256 indexed disputeId);
    event Ruling(uint256 indexed disputeId, uint8 ruling);
    event Settled(uint256 indexed id, uint256 toBeneficiary, uint256 fee, uint256 toDepositor);
    event Cancelled(uint256 indexed id);

    MockARGt internal token;
    Escrow internal escrow;

    address internal constant TREASURY = address(0x7EA5);
    address internal constant CREATOR = address(0xC1EA7);
    address internal constant DEPOSITOR = address(0xDE90);
    address internal constant BENEFICIARY = address(0xBEEF);
    address internal constant ARBITER = address(0xA4B1);
    address internal constant STRANGER = address(0xBAD);

    uint256 internal constant DEPOSIT = 600_000 ether; // 600.000 unidades demo
    bytes32 internal constant TERMS = keccak256("terminos-auto-001");

    uint40 internal acceptDl;
    uint40 internal reviewDl;

    function setUp() public {
        token = new MockARGt(address(this));
        escrow = new Escrow(IERC20(address(token)), TREASURY);
        acceptDl = uint40(block.timestamp + 1 days);
        reviewDl = uint40(block.timestamp + 7 days);
        token.mint(DEPOSITOR, 10_000_000 ether);
        vm.prank(DEPOSITOR);
        token.approve(address(escrow), type(uint256).max);
    }

    // ── Helpers de ciclo de vida ──

    function _create() internal returns (uint256 id) {
        vm.prank(CREATOR);
        id = escrow.create(Escrow.Template.Guarantee, DEPOSITOR, BENEFICIARY, ARBITER, DEPOSIT, TERMS, acceptDl, reviewDl);
    }

    function _accepted() internal returns (uint256 id) {
        id = _create();
        vm.prank(DEPOSITOR);
        escrow.accept(id);
    }

    function _funded() internal returns (uint256 id) {
        id = _accepted();
        vm.prank(DEPOSITOR);
        escrow.fund(id);
    }

    function _proposed(uint256 toBeneficiary) internal returns (uint256 id) {
        id = _funded();
        vm.prank(BENEFICIARY);
        escrow.proposeOutcome(id, toBeneficiary);
    }

    function _disputed() internal returns (uint256 id) {
        id = _funded();
        vm.prank(DEPOSITOR);
        escrow.dispute(id);
    }

    function _state(uint256 id) internal view returns (Escrow.State) {
        return escrow.agreements(id).state;
    }

    // ═══════════ create ═══════════

    function test_Create_StoresFieldsAndEmits() public {
        vm.expectEmit(true, false, false, true);
        emit AgreementCreated(1, Escrow.Template.Guarantee, DEPOSITOR, BENEFICIARY, DEPOSIT, TERMS);
        uint256 id = _create();
        assertEq(id, 1);
        assertEq(escrow.agreementCount(), 1);

        Escrow.Agreement memory a = escrow.agreements(id);
        assertEq(uint8(a.template), uint8(Escrow.Template.Guarantee));
        assertEq(uint8(a.state), uint8(Escrow.State.Created));
        assertEq(a.creator, CREATOR);
        assertEq(a.depositor, DEPOSITOR);
        assertEq(a.beneficiary, BENEFICIARY);
        assertEq(a.arbiter, ARBITER);
        assertEq(a.deposit, DEPOSIT);
        assertEq(a.remaining, 0);
        assertEq(a.termsHash, TERMS);
        assertEq(a.acceptDeadline, acceptDl);
        assertEq(a.reviewDeadline, reviewDl);
    }

    function test_Create_AnyCallerBecomesCreator() public {
        vm.prank(STRANGER);
        uint256 id = escrow.create(Escrow.Template.Sale, DEPOSITOR, BENEFICIARY, ARBITER, 1 ether, TERMS, acceptDl, reviewDl);
        assertEq(escrow.agreements(id).creator, STRANGER);
    }

    function test_Create_RevertZeroDeposit() public {
        vm.prank(CREATOR);
        vm.expectRevert(WrongAmount.selector);
        escrow.create(Escrow.Template.Guarantee, DEPOSITOR, BENEFICIARY, ARBITER, 0, TERMS, acceptDl, reviewDl);
    }

    function test_Create_RevertZeroAddresses() public {
        vm.startPrank(CREATOR);
        vm.expectRevert(ZeroAddress.selector);
        escrow.create(Escrow.Template.Guarantee, address(0), BENEFICIARY, ARBITER, DEPOSIT, TERMS, acceptDl, reviewDl);
        vm.expectRevert(ZeroAddress.selector);
        escrow.create(Escrow.Template.Guarantee, DEPOSITOR, address(0), ARBITER, DEPOSIT, TERMS, acceptDl, reviewDl);
        vm.expectRevert(ZeroAddress.selector);
        escrow.create(Escrow.Template.Guarantee, DEPOSITOR, BENEFICIARY, address(0), DEPOSIT, TERMS, acceptDl, reviewDl);
        vm.stopPrank();
    }

    function test_Constructor_RevertZeroAddresses() public {
        vm.expectRevert(ZeroAddress.selector);
        new Escrow(IERC20(address(0)), TREASURY);
        vm.expectRevert(ZeroAddress.selector);
        new Escrow(IERC20(address(token)), address(0));
    }

    // ═══════════ accept ═══════════

    function test_Accept_ByDepositor() public {
        uint256 id = _create();
        vm.expectEmit(true, false, false, false);
        emit Accepted(id);
        vm.prank(DEPOSITOR);
        escrow.accept(id);
        assertEq(uint8(_state(id)), uint8(Escrow.State.Accepted));
    }

    function test_Accept_RevertNonDepositor() public {
        uint256 id = _create();
        vm.prank(CREATOR);
        vm.expectRevert(NotDepositor.selector);
        escrow.accept(id);
        vm.prank(BENEFICIARY);
        vm.expectRevert(NotDepositor.selector);
        escrow.accept(id);
    }

    function test_Accept_RevertTwice() public {
        uint256 id = _accepted();
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.accept(id);
    }

    function test_Accept_AtDeadlineOk_AfterReverts() public {
        uint256 id = _create();
        vm.warp(acceptDl); // exactamente en el plazo: válido
        vm.prank(DEPOSITOR);
        escrow.accept(id);
        assertEq(uint8(_state(id)), uint8(Escrow.State.Accepted));

        uint256 id2 = _create();
        vm.warp(acceptDl + 1); // un segundo después: vencido
        vm.prank(DEPOSITOR);
        vm.expectRevert(DeadlinePassed.selector);
        escrow.accept(id2);
    }

    function test_Accept_RevertUnknownId() public {
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.accept(999);
    }

    // ═══════════ cancel / cancelExpired ═══════════

    function test_Cancel_ByCreator_CreatedAndAccepted() public {
        uint256 id = _create();
        vm.expectEmit(true, false, false, false);
        emit Cancelled(id);
        vm.prank(CREATOR);
        escrow.cancel(id);
        assertEq(uint8(_state(id)), uint8(Escrow.State.Cancelled));

        uint256 id2 = _accepted();
        vm.prank(CREATOR);
        escrow.cancel(id2);
        assertEq(uint8(_state(id2)), uint8(Escrow.State.Cancelled));
    }

    function test_Cancel_NoFundsMoved() public {
        uint256 id = _accepted();
        uint256 before = token.balanceOf(DEPOSITOR);
        vm.prank(CREATOR);
        escrow.cancel(id);
        assertEq(token.balanceOf(DEPOSITOR), before);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_Cancel_RevertNonCreator() public {
        uint256 id = _create();
        vm.prank(DEPOSITOR);
        vm.expectRevert(NotAuthorized.selector);
        escrow.cancel(id);
        vm.prank(BENEFICIARY);
        vm.expectRevert(NotAuthorized.selector);
        escrow.cancel(id);
    }

    function test_Cancel_RevertFunded() public {
        uint256 id = _funded();
        vm.prank(CREATOR);
        vm.expectRevert(InvalidState.selector);
        escrow.cancel(id);
    }

    function test_CancelExpired_BothParties_AfterDeadline() public {
        uint256 id = _create();
        uint256 id2 = _create();
        vm.warp(acceptDl + 1);
        vm.prank(DEPOSITOR);
        escrow.cancelExpired(id);
        assertEq(uint8(_state(id)), uint8(Escrow.State.Cancelled));
        vm.prank(CREATOR);
        escrow.cancelExpired(id2);
        assertEq(uint8(_state(id2)), uint8(Escrow.State.Cancelled));
    }

    function test_CancelExpired_Boundary() public {
        uint256 id = _create();
        vm.warp(acceptDl); // todavía no venció (se exige now > deadline)
        vm.prank(DEPOSITOR);
        vm.expectRevert(DeadlineNotPassed.selector);
        escrow.cancelExpired(id);
        vm.warp(acceptDl + 1);
        vm.prank(DEPOSITOR);
        escrow.cancelExpired(id);
    }

    function test_CancelExpired_RevertStrangerAndWrongState() public {
        uint256 id = _create();
        uint256 id2 = _accepted(); // Accepted no es cancelExpired aunque venza
        vm.warp(acceptDl + 1);
        vm.prank(STRANGER);
        vm.expectRevert(NotAuthorized.selector);
        escrow.cancelExpired(id);
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.cancelExpired(id2);
    }

    // ═══════════ fund ═══════════

    function test_Fund_CustodiesExactAmount() public {
        uint256 id = _accepted();
        uint256 depBefore = token.balanceOf(DEPOSITOR);
        vm.expectEmit(true, false, false, true);
        emit Funded(id, DEPOSIT);
        vm.prank(DEPOSITOR);
        escrow.fund(id);

        Escrow.Agreement memory a = escrow.agreements(id);
        assertEq(uint8(a.state), uint8(Escrow.State.Funded));
        assertEq(a.remaining, DEPOSIT);
        assertEq(token.balanceOf(address(escrow)), DEPOSIT);
        assertEq(token.balanceOf(DEPOSITOR), depBefore - DEPOSIT);
    }

    function test_Fund_RevertNonDepositor() public {
        uint256 id = _accepted();
        vm.prank(CREATOR);
        vm.expectRevert(NotDepositor.selector);
        escrow.fund(id);
    }

    function test_Fund_RevertWrongState() public {
        uint256 id = _create(); // aún Created
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.fund(id);
    }

    function test_Fund_RevertInsufficientAllowance() public {
        // Acuerdo con depositante sin allowance.
        address poor = address(0x9011);
        token.mint(poor, DEPOSIT);
        vm.prank(CREATOR);
        uint256 id = escrow.create(Escrow.Template.Guarantee, poor, BENEFICIARY, ARBITER, DEPOSIT, TERMS, acceptDl, reviewDl);
        vm.prank(poor);
        escrow.accept(id);
        vm.prank(poor);
        vm.expectRevert(InsufficientAllowance.selector);
        escrow.fund(id);
    }

    function test_Fund_RevertInsufficientBalance() public {
        address broke = address(0x9012);
        token.mint(broke, DEPOSIT - 1);
        vm.prank(broke);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(CREATOR);
        uint256 id = escrow.create(Escrow.Template.Guarantee, broke, BENEFICIARY, ARBITER, DEPOSIT, TERMS, acceptDl, reviewDl);
        vm.prank(broke);
        escrow.accept(id);
        vm.prank(broke);
        vm.expectRevert(InsufficientBalance.selector);
        escrow.fund(id);
    }

    function test_Fund_RevertTwice() public {
        uint256 id = _funded();
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.fund(id);
    }

    // ═══════════ proposeOutcome ═══════════

    function test_Propose_ByEachParty() public {
        uint256 id = _funded();
        vm.expectEmit(true, false, false, true);
        emit OutcomeProposed(id, BENEFICIARY, 180_000 ether);
        vm.prank(BENEFICIARY);
        escrow.proposeOutcome(id, 180_000 ether);
        Escrow.Agreement memory a = escrow.agreements(id);
        assertEq(uint8(a.state), uint8(Escrow.State.OutcomeProposed));
        assertEq(a.outcomeProposer, BENEFICIARY);
        assertEq(a.proposedToBeneficiary, 180_000 ether);

        uint256 id2 = _funded();
        vm.prank(DEPOSITOR);
        escrow.proposeOutcome(id2, 0);
        assertEq(escrow.agreements(id2).outcomeProposer, DEPOSITOR);
    }

    function test_Propose_RevertStranger() public {
        uint256 id = _funded();
        vm.prank(STRANGER);
        vm.expectRevert(NotAuthorized.selector);
        escrow.proposeOutcome(id, 1);
    }

    function test_Propose_RevertAboveRemaining() public {
        uint256 id = _funded();
        vm.prank(BENEFICIARY);
        vm.expectRevert(WrongAmount.selector);
        escrow.proposeOutcome(id, DEPOSIT + 1);
    }

    function test_Propose_BoundariesZeroAndFull() public {
        uint256 id = _funded();
        vm.prank(BENEFICIARY);
        escrow.proposeOutcome(id, 0);
        uint256 id2 = _funded();
        vm.prank(BENEFICIARY);
        escrow.proposeOutcome(id2, DEPOSIT);
        assertEq(escrow.agreements(id2).proposedToBeneficiary, DEPOSIT);
    }

    function test_Propose_RevertWrongState() public {
        uint256 id = _accepted();
        vm.prank(BENEFICIARY);
        vm.expectRevert(InvalidState.selector);
        escrow.proposeOutcome(id, 1);
    }

    function test_Repropose_OnlyOtherParty_InvalidatesPrevious() public {
        uint256 id = _proposed(180_000 ether); // propuso BENEFICIARY
        vm.prank(DEPOSITOR); // la otra parte repropone
        escrow.proposeOutcome(id, 50_000 ether);
        Escrow.Agreement memory a = escrow.agreements(id);
        assertEq(a.outcomeProposer, DEPOSITOR);
        assertEq(a.proposedToBeneficiary, 50_000 ether);
        assertEq(uint8(a.state), uint8(Escrow.State.OutcomeProposed));

        // El mismo proponente no puede re-proponer.
        vm.prank(DEPOSITOR);
        vm.expectRevert(NotAuthorized.selector);
        escrow.proposeOutcome(id, 60_000 ether);
    }

    // ═══════════ acceptOutcome ═══════════

    function test_AcceptOutcome_PartialClaim_ExactSplit() public {
        // A-04: reclamo parcial 180.000 de 600.000.
        uint256 id = _proposed(180_000 ether);
        uint256 depBefore = token.balanceOf(DEPOSITOR);
        uint256 benBefore = token.balanceOf(BENEFICIARY);
        uint256 treBefore = token.balanceOf(TREASURY);

        vm.expectEmit(true, false, false, true);
        emit Settled(id, 180_000 ether, 1_800 ether, 420_000 ether);
        vm.prank(DEPOSITOR); // la otra parte acepta
        escrow.acceptOutcome(id);

        Escrow.Agreement memory a = escrow.agreements(id);
        assertEq(uint8(a.state), uint8(Escrow.State.Settled));
        assertEq(a.remaining, 0);
        assertEq(token.balanceOf(BENEFICIARY) - benBefore, 178_200 ether); // neto
        assertEq(token.balanceOf(TREASURY) - treBefore, 1_800 ether); // fee 1%
        assertEq(token.balanceOf(DEPOSITOR) - depBefore, 420_000 ether); // resto
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_AcceptOutcome_FullClaim_And_FullRefund() public {
        // A-05: reclamo total con fee exacto.
        uint256 id = _proposed(DEPOSIT);
        vm.prank(DEPOSITOR);
        escrow.acceptOutcome(id);
        assertEq(token.balanceOf(BENEFICIARY), DEPOSIT - DEPOSIT / 100);
        assertEq(token.balanceOf(TREASURY), DEPOSIT / 100);

        // A-03: propuesta 0 = devolución total sin fee.
        uint256 id2 = _funded();
        vm.prank(BENEFICIARY);
        escrow.proposeOutcome(id2, 0);
        uint256 depBefore = token.balanceOf(DEPOSITOR);
        uint256 treBefore = token.balanceOf(TREASURY);
        vm.prank(DEPOSITOR);
        escrow.acceptOutcome(id2);
        assertEq(token.balanceOf(DEPOSITOR) - depBefore, DEPOSIT);
        assertEq(token.balanceOf(TREASURY), treBefore);
    }

    function test_AcceptOutcome_RevertProposer() public {
        uint256 id = _proposed(1 ether);
        vm.prank(BENEFICIARY); // quien propuso no puede aceptar
        vm.expectRevert(NotAuthorized.selector);
        escrow.acceptOutcome(id);
    }

    function test_AcceptOutcome_RevertStrangerAndNoProposal() public {
        uint256 id = _proposed(1 ether);
        vm.prank(STRANGER);
        vm.expectRevert(NotAuthorized.selector);
        escrow.acceptOutcome(id);

        uint256 id2 = _funded(); // Funded sin propuesta
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.acceptOutcome(id2);
    }

    // ═══════════ dispute ═══════════

    function test_Dispute_FromFundedAndProposed() public {
        uint256 id = _funded();
        vm.expectEmit(true, true, false, false);
        emit Dispute(id, 1);
        vm.prank(DEPOSITOR);
        uint256 dId = escrow.dispute(id);
        assertEq(dId, 1);
        assertEq(uint8(_state(id)), uint8(Escrow.State.Disputed));
        assertEq(escrow.agreements(id).disputeId, 1);

        // También desde OutcomeProposed, por cualquiera de las partes.
        uint256 id2 = _proposed(5 ether);
        vm.prank(BENEFICIARY);
        uint256 dId2 = escrow.dispute(id2);
        assertEq(dId2, 2);
        assertEq(escrow.disputeCount(), 2);
    }

    function test_Dispute_RevertStrangerAndWrongState() public {
        uint256 id = _funded();
        vm.prank(STRANGER);
        vm.expectRevert(NotAuthorized.selector);
        escrow.dispute(id);

        uint256 id2 = _accepted();
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.dispute(id2);
    }

    function test_Dispute_FreezesOutcomesAndRefund() public {
        uint256 id = _proposed(1 ether);
        vm.prank(DEPOSITOR);
        escrow.dispute(id);

        // Ni acceptOutcome, ni nueva propuesta, ni refund aunque venza el plazo.
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.acceptOutcome(id);
        vm.prank(BENEFICIARY);
        vm.expectRevert(InvalidState.selector);
        escrow.proposeOutcome(id, 2 ether);
        vm.warp(reviewDl + 1);
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.refundAfterTimeout(id);
    }

    // ═══════════ rule ═══════════

    function test_Rule_Split_ExactConservation() public {
        uint256 id = _disputed();
        uint256 toB = 250_000 ether;
        uint256 toD = DEPOSIT - toB;
        uint256 depBefore = token.balanceOf(DEPOSITOR);
        uint256 benBefore = token.balanceOf(BENEFICIARY);
        uint256 treBefore = token.balanceOf(TREASURY);

        vm.expectEmit(true, false, false, true);
        emit Ruling(1, 2); // RULING_SPLIT
        vm.expectEmit(true, false, false, true);
        emit Settled(id, toB, toB / 100, toD);
        vm.prank(ARBITER);
        escrow.rule(id, toB, toD);

        assertEq(uint8(_state(id)), uint8(Escrow.State.Settled));
        assertEq(token.balanceOf(BENEFICIARY) - benBefore, toB - toB / 100);
        assertEq(token.balanceOf(TREASURY) - treBefore, toB / 100);
        assertEq(token.balanceOf(DEPOSITOR) - depBefore, toD);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_Rule_AllToDepositor_NoFee() public {
        uint256 id = _disputed();
        uint256 depBefore = token.balanceOf(DEPOSITOR);
        vm.expectEmit(true, false, false, true);
        emit Ruling(1, 0); // RULING_DEPOSITOR
        vm.prank(ARBITER);
        escrow.rule(id, 0, DEPOSIT);
        assertEq(token.balanceOf(DEPOSITOR) - depBefore, DEPOSIT);
        assertEq(token.balanceOf(TREASURY), 0);
    }

    function test_Rule_AllToBeneficiary() public {
        uint256 id = _disputed();
        vm.expectEmit(true, false, false, true);
        emit Ruling(1, 1); // RULING_BENEFICIARY
        vm.prank(ARBITER);
        escrow.rule(id, DEPOSIT, 0);
        assertEq(token.balanceOf(BENEFICIARY), DEPOSIT - DEPOSIT / 100);
        assertEq(token.balanceOf(TREASURY), DEPOSIT / 100);
    }

    function test_Rule_RevertForeignCaller() public {
        uint256 id = _disputed();
        // Callback ajeno: cualquiera que no sea el árbitro designado.
        vm.prank(STRANGER);
        vm.expectRevert(NotArbiter.selector);
        escrow.rule(id, DEPOSIT, 0);
        vm.prank(DEPOSITOR);
        vm.expectRevert(NotArbiter.selector);
        escrow.rule(id, DEPOSIT, 0);
        vm.prank(BENEFICIARY);
        vm.expectRevert(NotArbiter.selector);
        escrow.rule(id, DEPOSIT, 0);
    }

    function test_Rule_RevertWrongSum() public {
        uint256 id = _disputed();
        vm.prank(ARBITER);
        vm.expectRevert(SplitMismatch.selector);
        escrow.rule(id, DEPOSIT - 1, 0); // suma < remaining
        vm.prank(ARBITER);
        vm.expectRevert(SplitMismatch.selector);
        escrow.rule(id, DEPOSIT, 1); // suma > remaining
        vm.prank(ARBITER);
        vm.expectRevert(SplitMismatch.selector);
        escrow.rule(id, 0, 0); // deja fondos atrás
    }

    function test_Rule_RevertNotDisputed() public {
        uint256 id = _funded();
        vm.prank(ARBITER);
        vm.expectRevert(InvalidState.selector);
        escrow.rule(id, DEPOSIT, 0);
    }

    // ═══════════ refundAfterTimeout ═══════════

    function test_Refund_AfterDeadline_Full_NoFee() public {
        uint256 id = _funded();
        vm.warp(reviewDl + 1);
        uint256 depBefore = token.balanceOf(DEPOSITOR);
        vm.expectEmit(true, false, false, true);
        emit Settled(id, 0, 0, DEPOSIT);
        vm.prank(DEPOSITOR);
        escrow.refundAfterTimeout(id);
        assertEq(token.balanceOf(DEPOSITOR) - depBefore, DEPOSIT);
        assertEq(token.balanceOf(TREASURY), 0);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(uint8(_state(id)), uint8(Escrow.State.Settled));
    }

    function test_Refund_Boundary_AtAndAfter() public {
        uint256 id = _funded();
        vm.warp(reviewDl); // exactamente en el plazo: aún no
        vm.prank(DEPOSITOR);
        vm.expectRevert(DeadlineNotPassed.selector);
        escrow.refundAfterTimeout(id);
        vm.warp(reviewDl + 1);
        vm.prank(DEPOSITOR);
        escrow.refundAfterTimeout(id);
    }

    function test_Refund_WorksWithPendingProposal() public {
        uint256 id = _proposed(100_000 ether);
        vm.warp(reviewDl + 1);
        uint256 depBefore = token.balanceOf(DEPOSITOR);
        vm.prank(DEPOSITOR);
        escrow.refundAfterTimeout(id);
        assertEq(token.balanceOf(DEPOSITOR) - depBefore, DEPOSIT);
    }

    function test_Refund_RevertNonDepositorAndWrongState() public {
        uint256 id = _funded();
        uint256 id2 = _accepted(); // Accepted aún sin fondos
        vm.warp(reviewDl + 1);
        vm.prank(BENEFICIARY);
        vm.expectRevert(NotDepositor.selector);
        escrow.refundAfterTimeout(id);
        vm.prank(DEPOSITOR);
        vm.expectRevert(InvalidState.selector);
        escrow.refundAfterTimeout(id2);
    }

    // ═══════════ doble settle / post-terminal ═══════════

    function test_DoubleSettle_AllPathsRevert() public {
        uint256 id = _proposed(1 ether);
        vm.prank(DEPOSITOR);
        escrow.acceptOutcome(id); // primer settle

        // Toda acción posterior sobre acuerdo terminal revierte AlreadySettled.
        vm.prank(DEPOSITOR);
        vm.expectRevert(AlreadySettled.selector);
        escrow.acceptOutcome(id);
        vm.prank(DEPOSITOR);
        vm.expectRevert(AlreadySettled.selector);
        escrow.refundAfterTimeout(id);
        vm.prank(ARBITER);
        vm.expectRevert(AlreadySettled.selector);
        escrow.rule(id, DEPOSIT, 0);
        vm.prank(CREATOR);
        vm.expectRevert(AlreadySettled.selector);
        escrow.cancel(id);
        vm.prank(DEPOSITOR);
        vm.expectRevert(AlreadySettled.selector);
        escrow.fund(id);
        vm.prank(DEPOSITOR);
        vm.expectRevert(AlreadySettled.selector);
        escrow.accept(id);
        vm.prank(DEPOSITOR);
        vm.expectRevert(AlreadySettled.selector);
        escrow.dispute(id);
        vm.prank(BENEFICIARY);
        vm.expectRevert(AlreadySettled.selector);
        escrow.proposeOutcome(id, 1);
    }

    function test_Cancelled_IsTerminalToo() public {
        uint256 id = _create();
        vm.prank(CREATOR);
        escrow.cancel(id);
        vm.prank(DEPOSITOR);
        vm.expectRevert(AlreadySettled.selector);
        escrow.accept(id);
        vm.prank(CREATOR);
        vm.expectRevert(AlreadySettled.selector);
        escrow.cancelExpired(id);
    }

    // ═══════════ conservación de un ciclo completo ═══════════

    function test_Conservation_SettledCycleZeroesEscrow() public {
        uint256 id = _disputed();
        uint256 total =
            token.balanceOf(DEPOSITOR) + token.balanceOf(BENEFICIARY) + token.balanceOf(TREASURY) + token.balanceOf(address(escrow));
        vm.prank(ARBITER);
        escrow.rule(id, 111_111 ether, DEPOSIT - 111_111 ether);
        uint256 totalAfter =
            token.balanceOf(DEPOSITOR) + token.balanceOf(BENEFICIARY) + token.balanceOf(TREASURY) + token.balanceOf(address(escrow));
        assertEq(total, totalAfter); // ni un wei creado o destruido
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    // ═══════════ múltiples acuerdos aislados ═══════════

    function test_Agreements_AreIsolated() public {
        uint256 id1 = _funded();
        uint256 id2 = _funded();
        assertEq(token.balanceOf(address(escrow)), DEPOSIT * 2);
        vm.prank(ARBITER);
        // id2 no está en disputa: no puede resolverse.
        vm.expectRevert(InvalidState.selector);
        escrow.rule(id2, DEPOSIT, 0);
        vm.warp(reviewDl + 1);
        vm.prank(DEPOSITOR);
        escrow.refundAfterTimeout(id1);
        assertEq(token.balanceOf(address(escrow)), DEPOSIT); // id2 intacto
        assertEq(escrow.agreements(id2).remaining, DEPOSIT);
    }
}
