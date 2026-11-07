// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Escrow} from "../Escrow.sol";
import {MockARGt} from "../MockARGt.sol";

contract EscrowTest is Test {
    Escrow internal escrow;
    MockARGt internal token;

    address internal payer = makeAddr("payer");
    address internal payee = makeAddr("payee");
    address internal outsider = makeAddr("outsider");
    address internal treasury = makeAddr("treasury");
    address internal arbiter = makeAddr("arbiter");

    uint256 internal constant INITIAL_BALANCE = 10_000_000e18;
    uint256 internal constant AMOUNT = 600_000e18;
    uint16 internal constant FEE_BPS = 100;

    uint256 internal deadline;
    bytes32 internal constant CONDITIONS = keccak256("plantilla A: garantia de auto");

    function setUp() public {
        token = new MockARGt();
        escrow = new Escrow(arbiter, treasury);

        token.mint(payer, INITIAL_BALANCE);
        vm.prank(payer);
        token.approve(address(escrow), type(uint256).max);

        deadline = block.timestamp + 7 days;
    }

    function _create() internal returns (uint256 id) {
        vm.prank(payer);
        id = escrow.create(payee, address(token), AMOUNT, FEE_BPS, deadline, CONDITIONS);
    }

    function _accepted() internal returns (uint256 id) {
        id = _create();
        vm.prank(payee);
        escrow.accept(id);
    }

    function _funded() internal returns (uint256 id) {
        id = _accepted();
        vm.prank(payer);
        escrow.fund(id);
    }

    function _delivered() internal returns (uint256 id) {
        id = _funded();
        vm.prank(payee);
        escrow.markDelivered(id);
    }

    function _state(uint256 id) internal view returns (Escrow.State) {
        return escrow.getAgreement(id).state;
    }

    // ---------------------------------------------------------------------
    // Creacion y fondeo
    // ---------------------------------------------------------------------

    function test_CreateStoresAgreement() public {
        uint256 id = _create();
        Escrow.Agreement memory agreement = escrow.getAgreement(id);

        assertEq(id, 1);
        assertEq(escrow.nextAgreementId(), 2);
        assertEq(agreement.id, id);
        assertEq(agreement.payer, payer);
        assertEq(agreement.payee, payee);
        assertEq(agreement.token, address(token));
        assertEq(agreement.amount, AMOUNT);
        assertEq(uint256(agreement.feeBps), uint256(FEE_BPS));
        assertEq(agreement.deadline, deadline);
        assertEq(agreement.conditionsHash, CONDITIONS);
        assertEq(uint256(agreement.state), uint256(Escrow.State.Created));
        assertEq(uint256(agreement.tokenDecimals), 18);
    }

    function test_FundMovesTokensIntoEscrow() public {
        uint256 id = _funded();

        assertEq(uint256(_state(id)), uint256(Escrow.State.Funded));
        assertEq(token.balanceOf(address(escrow)), AMOUNT);
        assertEq(token.balanceOf(payer), INITIAL_BALANCE - AMOUNT);
    }

    function test_AcceptOnlyOnce() public {
        uint256 id = _accepted();
        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Accepted));
        escrow.accept(id);
    }

    function test_FundTwiceReverts() public {
        uint256 id = _funded();
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Funded));
        escrow.fund(id);
    }

    // ---------------------------------------------------------------------
    // Release
    // ---------------------------------------------------------------------

    function test_ReleasePaysNetAndFee() public {
        uint256 id = _delivered();
        uint256 fee = (AMOUNT * FEE_BPS) / 10_000;
        uint256 netAmount = AMOUNT - fee;

        vm.prank(payer);
        escrow.release(id);

        assertEq(uint256(_state(id)), uint256(Escrow.State.Completed));
        assertEq(token.balanceOf(payee), netAmount);
        assertEq(token.balanceOf(treasury), fee);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(payee.balance, 0);

        assertEq(netAmount, 594_000e18);
        assertEq(fee, 6_000e18);
    }

    function test_DoubleReleaseReverts() public {
        uint256 id = _delivered();
        vm.prank(payer);
        escrow.release(id);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Completed));
        escrow.release(id);
    }

    function test_ReleaseBeforeDeliveryReverts() public {
        uint256 id = _funded();
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Funded));
        escrow.release(id);
    }

    // ---------------------------------------------------------------------
    // Refund
    // ---------------------------------------------------------------------

    function test_RefundReturnsFullDepositWithoutFee() public {
        uint256 id = _funded();

        vm.prank(payer);
        escrow.refund(id);

        assertEq(uint256(_state(id)), uint256(Escrow.State.Refunded));
        assertEq(token.balanceOf(payer), INITIAL_BALANCE);
        assertEq(token.balanceOf(treasury), 0);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_RefundAfterDeliveredReverts() public {
        uint256 id = _delivered();
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Delivered));
        escrow.refund(id);
    }

    // ---------------------------------------------------------------------
    // Settle / disputa
    // ---------------------------------------------------------------------

    function test_SettlePartial30_70() public {
        uint256 id = _delivered();
        uint256 toPayee = 180_000e18;
        uint256 toPayer = 420_000e18;
        uint256 fee = (toPayee * FEE_BPS) / 10_000;
        uint256 netAmount = toPayee - fee;

        vm.prank(arbiter);
        escrow.settle(id, toPayee, toPayer);

        assertEq(uint256(_state(id)), uint256(Escrow.State.Settled));
        assertEq(token.balanceOf(payee), netAmount);
        assertEq(token.balanceOf(treasury), fee);
        assertEq(token.balanceOf(payer), INITIAL_BALANCE - toPayee);
        assertEq(token.balanceOf(address(escrow)), 0);

        assertEq(netAmount, 178_200e18);
        assertEq(fee, 1_800e18);
    }

    function test_SettleFullAfterDispute() public {
        uint256 id = _funded();
        vm.prank(payer);
        escrow.dispute(id);
        assertEq(uint256(_state(id)), uint256(Escrow.State.Disputed));

        uint256 fee = (AMOUNT * FEE_BPS) / 10_000;
        vm.prank(arbiter);
        escrow.settle(id, AMOUNT, 0);

        assertEq(uint256(_state(id)), uint256(Escrow.State.Settled));
        assertEq(token.balanceOf(payee), AMOUNT - fee);
        assertEq(token.balanceOf(treasury), fee);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_SettleRemainderReturnsToPayer() public {
        uint256 id = _delivered();
        uint256 toPayee = 180_000e18;
        uint256 requestedToPayer = 300_000e18;

        vm.prank(arbiter);
        escrow.settle(id, toPayee, requestedToPayer);

        // El remanente no asignado (600k - 180k) vuelve al pagador.
        assertEq(token.balanceOf(payer), INITIAL_BALANCE - toPayee);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_SettleSumTooHighReverts() public {
        uint256 id = _delivered();
        vm.prank(arbiter);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidSettlement.selector, AMOUNT, 1, AMOUNT));
        escrow.settle(id, AMOUNT, 1);
    }

    function test_SettleBeforeDeliveryReverts() public {
        uint256 id = _funded();
        vm.prank(arbiter);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Funded));
        escrow.settle(id, AMOUNT, 0);
    }

    function test_SettleTwiceReverts() public {
        uint256 id = _delivered();
        vm.prank(arbiter);
        escrow.settle(id, AMOUNT, 0);

        vm.prank(arbiter);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Settled));
        escrow.settle(id, AMOUNT, 0);
    }

    // ---------------------------------------------------------------------
    // Reclamo bilateral: proposeOutcome / acceptOutcome
    // ---------------------------------------------------------------------

    function test_ProposeOutcomeByPayerAcceptedByPayee() public {
        uint256 id = _funded();
        uint256 toPayee = 180_000e18;
        uint256 fee = (toPayee * FEE_BPS) / 10_000;

        vm.prank(payer);
        escrow.proposeOutcome(id, toPayee);

        Escrow.Agreement memory proposed = escrow.getAgreement(id);
        assertEq(uint256(proposed.state), uint256(Escrow.State.OutcomeProposed));
        assertEq(proposed.pendingToPayee, toPayee);
        assertEq(proposed.outcomeProposer, payer);

        vm.prank(payee);
        escrow.acceptOutcome(id);

        Escrow.Agreement memory settled = escrow.getAgreement(id);
        assertEq(uint256(settled.state), uint256(Escrow.State.Settled));
        assertEq(settled.pendingToPayee, 0);
        assertEq(settled.outcomeProposer, address(0));
        assertEq(token.balanceOf(payee), toPayee - fee);
        assertEq(token.balanceOf(treasury), fee);
        assertEq(token.balanceOf(payer), INITIAL_BALANCE - toPayee);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(token.balanceOf(payee) + token.balanceOf(treasury) + token.balanceOf(payer), INITIAL_BALANCE);
    }

    function test_ProposeOutcomeByPayeeAcceptedByPayer() public {
        uint256 id = _funded();
        uint256 toPayee = 300_000e18;
        uint256 fee = (toPayee * FEE_BPS) / 10_000;

        vm.prank(payee);
        escrow.proposeOutcome(id, toPayee);
        assertEq(escrow.getAgreement(id).outcomeProposer, payee);

        vm.prank(payer);
        escrow.acceptOutcome(id);

        assertEq(uint256(_state(id)), uint256(Escrow.State.Settled));
        assertEq(token.balanceOf(payee), toPayee - fee);
        assertEq(token.balanceOf(treasury), fee);
        assertEq(token.balanceOf(payer), INITIAL_BALANCE - toPayee);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_ProposerCannotAcceptOwnProposal() public {
        uint256 id = _funded();
        vm.prank(payer);
        escrow.proposeOutcome(id, 180_000e18);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payer));
        escrow.acceptOutcome(id);

        vm.prank(payee);
        escrow.acceptOutcome(id);

        uint256 id2 = _funded();
        vm.prank(payee);
        escrow.proposeOutcome(id2, 180_000e18);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payee));
        escrow.acceptOutcome(id2);

        vm.prank(payer);
        escrow.acceptOutcome(id2);
    }

    function test_DoubleProposeBySameActorRevertsAndCounterpartyCanRepropose() public {
        uint256 id = _funded();
        vm.prank(payer);
        escrow.proposeOutcome(id, 180_000e18);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payer));
        escrow.proposeOutcome(id, 200_000e18);

        uint256 newToPayee = 240_000e18;
        vm.prank(payee);
        escrow.proposeOutcome(id, newToPayee);

        Escrow.Agreement memory proposed = escrow.getAgreement(id);
        assertEq(proposed.pendingToPayee, newToPayee);
        assertEq(proposed.outcomeProposer, payee);

        vm.prank(payer);
        escrow.acceptOutcome(id);

        uint256 fee = (newToPayee * FEE_BPS) / 10_000;
        assertEq(token.balanceOf(payee), newToPayee - fee);
        assertEq(token.balanceOf(payer), INITIAL_BALANCE - newToPayee);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_ProposeOutcomeAboveAmountReverts() public {
        uint256 id = _funded();
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidOutcome.selector, AMOUNT + 1, AMOUNT));
        escrow.proposeOutcome(id, AMOUNT + 1);
    }

    function test_ProposeOutcomeOnlyInFundedOrOutcomeProposed() public {
        uint256 delivered = _delivered();
        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(Escrow.InvalidState.selector, delivered, Escrow.State.Delivered)
        );
        escrow.proposeOutcome(delivered, 180_000e18);

        uint256 created = _create();
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, created, Escrow.State.Created));
        escrow.proposeOutcome(created, 180_000e18);

        uint256 funded = _funded();
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, outsider));
        escrow.proposeOutcome(funded, 180_000e18);
    }

    function test_AcceptOutcomeInvalidStateReverts() public {
        uint256 id = _funded();
        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Funded));
        escrow.acceptOutcome(id);

        vm.prank(payer);
        escrow.proposeOutcome(id, 180_000e18);
        vm.prank(payee);
        escrow.acceptOutcome(id);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Settled));
        escrow.acceptOutcome(id);
    }

    function test_AcceptOutcomeOnlyCounterparty() public {
        uint256 id = _funded();
        vm.prank(payer);
        escrow.proposeOutcome(id, 180_000e18);

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, outsider));
        escrow.acceptOutcome(id);

        vm.prank(payee);
        escrow.acceptOutcome(id);
    }

    function test_AcceptOutcomeConservesFunds() public {
        uint256 id = _funded();
        uint256 toPayee = 123_457e18;
        uint256 fee = (toPayee * FEE_BPS) / 10_000;

        vm.prank(payee);
        escrow.proposeOutcome(id, toPayee);
        vm.prank(payer);
        escrow.acceptOutcome(id);

        assertEq(token.balanceOf(payee), toPayee - fee);
        assertEq(token.balanceOf(treasury), fee);
        assertEq(token.balanceOf(payer), INITIAL_BALANCE - toPayee);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(token.balanceOf(payee) + token.balanceOf(treasury) + token.balanceOf(payer), INITIAL_BALANCE);
    }

    function test_AcceptOutcomeWithSixDecimalToken() public {
        SixDecimalToken usdc = new SixDecimalToken();
        uint256 amount = 1_000e6;
        usdc.mint(payer, amount);
        vm.prank(payer);
        usdc.approve(address(escrow), amount);

        vm.prank(payer);
        uint256 id = escrow.create(payee, address(usdc), amount, FEE_BPS, deadline, CONDITIONS);
        vm.prank(payee);
        escrow.accept(id);
        vm.prank(payer);
        escrow.fund(id);

        uint256 toPayee = 300e6;
        vm.prank(payee);
        escrow.proposeOutcome(id, toPayee);
        vm.prank(payer);
        escrow.acceptOutcome(id);

        uint256 fee = (toPayee * FEE_BPS) / 10_000;
        assertEq(uint256(escrow.getAgreement(id).tokenDecimals), 6);
        assertEq(usdc.balanceOf(payee), toPayee - fee);
        assertEq(usdc.balanceOf(treasury), fee);
        assertEq(usdc.balanceOf(payer), amount - toPayee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(fee, 3e6);
    }

    // ---------------------------------------------------------------------
    // Cancel
    // ---------------------------------------------------------------------

    function test_CancelBeforeFunding() public {
        uint256 id = _accepted();
        vm.prank(payer);
        escrow.cancel(id);

        assertEq(uint256(_state(id)), uint256(Escrow.State.Cancelled));
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_CancelAfterFundingReverts() public {
        uint256 id = _funded();
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.InvalidState.selector, id, Escrow.State.Funded));
        escrow.cancel(id);
    }

    // ---------------------------------------------------------------------
    // Permisos
    // ---------------------------------------------------------------------

    function test_UnauthorizedActorsRevert() public {
        uint256 id = _create();

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payer));
        escrow.accept(id);

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, outsider));
        escrow.accept(id);

        vm.prank(payee);
        escrow.accept(id);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payee));
        escrow.fund(id);

        vm.prank(payer);
        escrow.fund(id);

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, outsider));
        escrow.dispute(id);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payer));
        escrow.markDelivered(id);

        vm.prank(payee);
        escrow.markDelivered(id);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payee));
        escrow.release(id);

        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payee));
        escrow.refund(id);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payer));
        escrow.settle(id, AMOUNT, 0);

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, outsider));
        escrow.settle(id, AMOUNT, 0);
    }

    function test_CancelOnlyPayer() public {
        uint256 id = _create();
        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(Escrow.Unauthorized.selector, payee));
        escrow.cancel(id);
    }

    // ---------------------------------------------------------------------
    // Validaciones
    // ---------------------------------------------------------------------

    function test_FeeCapEnforced() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.FeeTooHigh.selector, 201));
        escrow.create(payee, address(token), AMOUNT, 201, deadline, CONDITIONS);
    }

    function test_ZeroAmountReverts() public {
        vm.prank(payer);
        vm.expectRevert(Escrow.ZeroAmount.selector);
        escrow.create(payee, address(token), 0, FEE_BPS, deadline, CONDITIONS);
    }

    function test_UnknownAgreementReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Escrow.AgreementNotFound.selector, 999));
        escrow.getAgreement(999);
    }

    function test_ZeroAddressReverts() public {
        vm.prank(payer);
        vm.expectRevert(Escrow.ZeroAddress.selector);
        escrow.create(address(0), address(token), AMOUNT, FEE_BPS, deadline, CONDITIONS);
    }

    // ---------------------------------------------------------------------
    // Token con decimales distintos de 18
    // ---------------------------------------------------------------------

    function test_WorksWithSixDecimalToken() public {
        SixDecimalToken usdc = new SixDecimalToken();
        uint256 amount = 1_000e6;

        usdc.mint(payer, amount);
        vm.prank(payer);
        usdc.approve(address(escrow), amount);

        vm.prank(payer);
        uint256 id = escrow.create(payee, address(usdc), amount, FEE_BPS, deadline, CONDITIONS);
        vm.prank(payee);
        escrow.accept(id);
        vm.prank(payer);
        escrow.fund(id);
        vm.prank(payee);
        escrow.markDelivered(id);
        vm.prank(payer);
        escrow.release(id);

        uint256 fee = (amount * FEE_BPS) / 10_000;
        assertEq(uint256(escrow.getAgreement(id).tokenDecimals), 6);
        assertEq(usdc.balanceOf(payee), amount - fee);
        assertEq(usdc.balanceOf(treasury), fee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(fee, 10e6);
    }

    // ---------------------------------------------------------------------
    // Reentrancy
    // ---------------------------------------------------------------------

    function test_ReentrancyOnReleaseIsBlocked() public {
        ReentrantToken reentrant = new ReentrantToken();
        uint256 id = reentrant.setup(escrow, payee, 100e18, FEE_BPS, CONDITIONS);

        vm.prank(payee);
        escrow.accept(id);
        reentrant.fund();
        vm.prank(payee);
        escrow.markDelivered(id);

        reentrant.attack();

        assertTrue(reentrant.reentryBlocked(), "el reintento de release deberia fallar");
        assertEq(reentrant.reentryError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(uint256(_state(id)), uint256(Escrow.State.Completed));
        assertEq(reentrant.balanceOf(address(escrow)), 0);
    }
}

/// @dev Token de 6 decimales para verificar que el escrow lee decimals() del token.
contract SixDecimalToken is ERC20 {
    constructor() ERC20("USD Coin mock", "USDCm") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Token malicioso que intenta reentrar en release() durante el pago.
contract ReentrantToken is ERC20 {
    Escrow private _escrow;
    uint256 public agreementId;
    bool private _attacking;
    bool public reentryBlocked;
    bytes4 public reentryError;

    constructor() ERC20("Reentrant tARGt", "rARGt") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function setup(Escrow escrow_, address payee, uint256 amount, uint16 feeBps, bytes32 conditions)
        external
        returns (uint256 id)
    {
        _escrow = escrow_;
        _mint(address(this), amount);
        id = escrow_.create(payee, address(this), amount, feeBps, block.timestamp + 1 days, conditions);
        agreementId = id;
        _approve(address(this), address(escrow_), type(uint256).max);
    }

    function fund() external {
        _escrow.fund(agreementId);
    }

    function attack() external {
        _attacking = true;
        _escrow.release(agreementId);
        _attacking = false;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (_attacking) {
            (bool ok, bytes memory returndata) =
                address(_escrow).call(abi.encodeCall(Escrow.release, (agreementId)));
            if (!ok) {
                reentryBlocked = true;
                if (returndata.length >= 4) {
                    bytes4 selector;
                    assembly {
                        selector := mload(add(returndata, 0x20))
                    }
                    reentryError = selector;
                }
            }
        }
        super._update(from, to, value);
    }
}
