// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Escrow
/// @notice Custodia un token ERC-20 entre un pagador y un beneficiario hasta que se
///         libera, se devuelve, se cancela o la resuelve el arbitro del MVP.
/// @dev El token se parametriza por acuerdo; no se asume una cantidad fija de decimales.
///      El arbitro del MVP es una direccion mock; la interfaz ERC-792 real queda para
///      despues del hackathon. El deadline es informativo: no dispara ninguna accion.
contract Escrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State {
        None,
        Created,
        Accepted,
        Funded,
        Delivered,
        Completed,
        Refunded,
        Settled,
        Disputed,
        Cancelled
    }

    struct Agreement {
        uint256 id;
        address payer;
        address payee;
        address token;
        uint256 amount;
        uint16 feeBps;
        uint256 deadline;
        bytes32 conditionsHash;
        State state;
        uint8 tokenDecimals;
    }

    /// @notice Tope de comision: 2% (200 bps).
    uint16 public constant MAX_FEE_BPS = 200;
    /// @notice Base para calcular bps.
    uint16 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Direccion que recibe las comisiones.
    address public immutable treasury;
    /// @notice Direccion autorizada a resolver disputas (mock ERC-792 en la demo).
    address public immutable arbiter;

    /// @notice Proximo id de acuerdo. Arranca en 1 para que 0 sea "no existe".
    uint256 public nextAgreementId = 1;

    mapping(uint256 id => Agreement agreement) private _agreements;

    event Created(
        uint256 indexed id,
        address indexed payer,
        address indexed payee,
        address token,
        uint256 amount,
        uint16 feeBps,
        uint256 deadline,
        bytes32 conditionsHash
    );
    event Accepted(uint256 indexed id, address indexed payee);
    event Funded(uint256 indexed id, address indexed payer, uint256 amount);
    event Delivered(uint256 indexed id, address indexed payee);
    event Released(uint256 indexed id, address indexed payee, uint256 netAmount, uint256 fee);
    event Refunded(uint256 indexed id, address indexed payer, uint256 amount);
    event Disputed(uint256 indexed id, address indexed by);
    event Settled(uint256 indexed id, uint256 toPayeeNet, uint256 toPayer, uint256 fee);
    event Cancelled(uint256 indexed id);

    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh(uint16 feeBps);
    error AgreementNotFound(uint256 id);
    error InvalidState(uint256 id, State current);
    error Unauthorized(address caller);
    error InvalidSettlement(uint256 toPayee, uint256 toPayer, uint256 amount);

    constructor(address arbiter_, address treasury_) {
        if (arbiter_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        arbiter = arbiter_;
        treasury = treasury_;
    }

    /// @notice Crea un acuerdo. El pagador es msg.sender.
    /// @param payee Beneficiario que debe aceptar el acuerdo.
    /// @param token Token ERC-20 a custodiar.
    /// @param amount Monto exacto en unidades minimas del token.
    /// @param feeBps Comision en bps, solo sobre la porcion del beneficiario (max 200).
    /// @param deadline Fecha informativa de vencimiento (timestamp Unix).
    /// @param conditionsHash Hash de las condiciones aceptadas por las partes.
    function create(
        address payee,
        address token,
        uint256 amount,
        uint16 feeBps,
        uint256 deadline,
        bytes32 conditionsHash
    ) external returns (uint256 id) {
        if (payee == address(0) || token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh(feeBps);

        id = nextAgreementId++;
        uint8 tokenDecimals = IERC20Metadata(token).decimals();

        Agreement storage agreement = _agreements[id];
        agreement.id = id;
        agreement.payer = msg.sender;
        agreement.payee = payee;
        agreement.token = token;
        agreement.amount = amount;
        agreement.feeBps = feeBps;
        agreement.deadline = deadline;
        agreement.conditionsHash = conditionsHash;
        agreement.state = State.Created;
        agreement.tokenDecimals = tokenDecimals;

        emit Created(id, msg.sender, payee, token, amount, feeBps, deadline, conditionsHash);
    }

    /// @notice Acepta el acuerdo. Solo el beneficiario, desde Created.
    function accept(uint256 id) external {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.payee) revert Unauthorized(msg.sender);
        _requireState(agreement, State.Created);
        agreement.state = State.Accepted;
        emit Accepted(id, msg.sender);
    }

    /// @notice Deposita el monto en custodia. Solo el pagador, desde Accepted.
    function fund(uint256 id) external nonReentrant {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.payer) revert Unauthorized(msg.sender);
        _requireState(agreement, State.Accepted);

        agreement.state = State.Funded;
        IERC20(agreement.token).safeTransferFrom(agreement.payer, address(this), agreement.amount);

        emit Funded(id, msg.sender, agreement.amount);
    }

    /// @notice Marca la entrega. Solo el beneficiario, desde Funded.
    function markDelivered(uint256 id) external {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.payee) revert Unauthorized(msg.sender);
        _requireState(agreement, State.Funded);
        agreement.state = State.Delivered;
        emit Delivered(id, msg.sender);
    }

    /// @notice Libera el pago al beneficiario. Solo el pagador, desde Delivered.
    /// @dev Paga amount - fee al beneficiario y fee a la tesoreria.
    function release(uint256 id) external nonReentrant {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.payer) revert Unauthorized(msg.sender);
        _requireState(agreement, State.Delivered);

        uint256 amount = agreement.amount;
        uint256 fee = (amount * agreement.feeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;

        agreement.state = State.Completed;

        IERC20 token = IERC20(agreement.token);
        token.safeTransfer(agreement.payee, netAmount);
        if (fee > 0) token.safeTransfer(treasury, fee);

        emit Released(id, agreement.payee, netAmount, fee);
    }

    /// @notice Devuelve el deposito completo al pagador, sin comision.
    /// @dev Solo desde Funded: despues de la entrega ya no se puede reembolsar.
    function refund(uint256 id) external nonReentrant {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.payer) revert Unauthorized(msg.sender);
        _requireState(agreement, State.Funded);

        agreement.state = State.Refunded;
        IERC20(agreement.token).safeTransfer(agreement.payer, agreement.amount);

        emit Refunded(id, agreement.payer, agreement.amount);
    }

    /// @notice Abre una disputa. Cualquiera de las partes, desde Funded o Delivered.
    function dispute(uint256 id) external {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.payer && msg.sender != agreement.payee) {
            revert Unauthorized(msg.sender);
        }
        if (agreement.state != State.Funded && agreement.state != State.Delivered) {
            revert InvalidState(id, agreement.state);
        }

        agreement.state = State.Disputed;
        emit Disputed(id, msg.sender);
    }

    /// @notice Resuelve el acuerdo. Solo el arbitro, desde Delivered o Disputed.
    /// @param toPayee Porcion bruta que va al beneficiario (antes del fee).
    /// @param toPayer Porcion que va al pagador. toPayee + toPayer debe ser <= amount.
    /// @dev El fee se calcula solo sobre toPayee. Cualquier remanente no asignado
    ///      vuelve al pagador para que no queden fondos atrapados.
    function settle(uint256 id, uint256 toPayee, uint256 toPayer) external nonReentrant {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != arbiter) revert Unauthorized(msg.sender);
        if (agreement.state != State.Delivered && agreement.state != State.Disputed) {
            revert InvalidState(id, agreement.state);
        }

        uint256 amount = agreement.amount;
        if (toPayee + toPayer > amount) revert InvalidSettlement(toPayee, toPayer, amount);

        uint256 fee = (toPayee * agreement.feeBps) / BPS_DENOMINATOR;
        uint256 netAmount = toPayee - fee;
        uint256 toPayerActual = amount - toPayee;

        agreement.state = State.Settled;

        IERC20 token = IERC20(agreement.token);
        if (netAmount > 0) token.safeTransfer(agreement.payee, netAmount);
        if (fee > 0) token.safeTransfer(treasury, fee);
        if (toPayerActual > 0) token.safeTransfer(agreement.payer, toPayerActual);

        emit Settled(id, netAmount, toPayerActual, fee);
    }

    /// @notice Cancela un acuerdo sin fondos. Solo el pagador, desde Created o Accepted.
    function cancel(uint256 id) external {
        Agreement storage agreement = _agreement(id);
        if (msg.sender != agreement.payer) revert Unauthorized(msg.sender);
        if (agreement.state != State.Created && agreement.state != State.Accepted) {
            revert InvalidState(id, agreement.state);
        }

        agreement.state = State.Cancelled;
        emit Cancelled(id);
    }

    /// @notice Devuelve el acuerdo completo.
    function getAgreement(uint256 id) external view returns (Agreement memory) {
        return _agreement(id);
    }

    function _agreement(uint256 id) private view returns (Agreement storage agreement) {
        agreement = _agreements[id];
        if (agreement.state == State.None) revert AgreementNotFound(id);
    }

    function _requireState(Agreement storage agreement, State expected) private view {
        if (agreement.state != expected) revert InvalidState(agreement.id, agreement.state);
    }
}
