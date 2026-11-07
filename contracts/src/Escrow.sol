// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ── Errores — nombres alineados con shared/errors.ts (los consume la UI) ──
error NotAuthorized(); // El llamador no tiene el rol que exige la acción
error InvalidState(); // El acuerdo no está en el estado requerido
error NotDepositor(); // Acción exclusiva de quien deposita
error NotArbiter(); // `rule` llamado por alguien que no es el árbitro
error AlreadySettled(); // El acuerdo ya está en estado terminal
error WrongAmount(); // Monto inválido (depósito 0, outcome > remaining)
error SplitMismatch(); // toBeneficiary + toDepositor != remaining
error DeadlinePassed(); // El plazo ya venció
error DeadlineNotPassed(); // El plazo todavía no venció
error InsufficientBalance(); // Saldo del depositante menor al depósito
error InsufficientAllowance(); // Allowance ERC-20 menor al depósito
error ZeroAddress(); // Parte/token/treasury en address(0) — extra, sin texto en errors.ts

/// @title Escrow — máquina de estados de fondos ContractAR (spec 02/03).
/// @notice Motor único para plantilla A (garantía) y B (compraventa).
///         Flujo: Created → Accepted → Funded → Settled, con subestados
///         OutcomeProposed y Disputed de fondos congelados, cancelación
///         previa al fondeo y reembolso por timeout a favor del depositante.
/// @dev Reglas clave:
///      - `settle` interno exige `toBeneficiary + toDepositor == remaining`
///        (terminal: distribuye TODO el saldo restante del acuerdo).
///      - `fee = floor(toBeneficiary * FEE_BPS / 10_000)` sobre la porción del
///        beneficiario; devoluciones al depositante nunca pagan fee.
///      - Tokens con fee-on-transfer/rebasing NO soportados: `fund` revierte
///        `WrongAmount` si el escrow no recibe el depósito exacto.
///      - `Resolved` existe en el enum por compatibilidad de interfaz; la
///        transición Disputed → Resolved → Settled es atómica dentro de `rule`,
///        por lo que nunca persiste en storage.
contract Escrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State {
        None,
        Created,
        Accepted,
        Funded,
        OutcomeProposed,
        Disputed,
        Settled,
        Cancelled,
        Resolved
    }
    enum Template {
        Guarantee,
        Sale
    }

    struct Agreement {
        Template template;
        State state;
        address creator;
        address depositor;
        address beneficiary;
        address arbiter;
        uint256 deposit;
        uint256 remaining;
        bytes32 termsHash;
        uint40 acceptDeadline;
        uint40 reviewDeadline;
        address outcomeProposer;
        uint256 proposedToBeneficiary;
        uint256 disputeId;
    }

    // ── Eventos (spec 03; Dispute/Ruling con estilo ERC-792) ──
    event AgreementCreated(
        uint256 indexed id,
        Template template,
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

    /// @notice Bases points de fee cobrado a la porción del beneficiario (100 = 1%).
    uint256 public constant FEE_BPS = 100;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Códigos del evento `Ruling` (mock ERC-792).
    uint8 public constant RULING_DEPOSITOR = 0; // fallo íntegro a favor del depositante
    uint8 public constant RULING_BENEFICIARY = 1; // fallo íntegro a favor del beneficiario
    uint8 public constant RULING_SPLIT = 2; // reparto parcial

    /// @notice Token ERC-20 custodiado (MockARGt en demo).
    IERC20 public immutable token;
    /// @notice Receptora del fee de plataforma; fijada en el deploy, sin otros poderes.
    address public immutable treasury;

    /// @notice Cantidad de acuerdos creados; los ids válidos son 1..agreementCount.
    uint256 public agreementCount;
    /// @notice Cantidad de disputas abiertas históricamente (fuente de disputeId).
    uint256 public disputeCount;

    mapping(uint256 => Agreement) private _agreements;

    /// @param token_ token ERC-20 estándar (sin fee-on-transfer/rebasing).
    /// @param treasury_ receptora del fee; no puede ser address(0).
    constructor(IERC20 token_, address treasury_) {
        if (address(token_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        token = token_;
        treasury = treasury_;
    }

    /// @notice Crea un acuerdo en estado `Created`; `msg.sender` queda `creator`.
    /// @return id identificador del acuerdo (empieza en 1).
    function create(
        Template template_,
        address depositor,
        address beneficiary,
        address arbiter,
        uint256 deposit,
        bytes32 termsHash,
        uint40 acceptDeadline,
        uint40 reviewDeadline
    ) external returns (uint256 id) {
        if (depositor == address(0) || beneficiary == address(0) || arbiter == address(0)) {
            revert ZeroAddress();
        }
        if (deposit == 0) revert WrongAmount();

        id = ++agreementCount;
        Agreement storage a = _agreements[id];
        a.template = template_;
        a.state = State.Created;
        a.creator = msg.sender;
        a.depositor = depositor;
        a.beneficiary = beneficiary;
        a.arbiter = arbiter;
        a.deposit = deposit;
        a.termsHash = termsHash;
        a.acceptDeadline = acceptDeadline;
        a.reviewDeadline = reviewDeadline;

        emit AgreementCreated(id, template_, depositor, beneficiary, deposit, termsHash);
    }

    /// @notice El depositante acepta los términos (hash ya fijado en `create`).
    function accept(uint256 id) external {
        Agreement storage a = _agreements[id];
        _requireNotTerminal(a);
        if (a.state != State.Created) revert InvalidState();
        if (msg.sender != a.depositor) revert NotDepositor();
        // forge-lint: disable-next-line(block-timestamp) — los plazos del spec son timestamps de bloque
        if (block.timestamp > a.acceptDeadline) revert DeadlinePassed();

        a.state = State.Accepted;
        emit Accepted(id);
    }

    /// @notice El creador cancela antes de que haya fondos (Created o Accepted).
    function cancel(uint256 id) external {
        Agreement storage a = _agreements[id];
        _requireNotTerminal(a);
        if (a.state != State.Created && a.state != State.Accepted) revert InvalidState();
        if (msg.sender != a.creator) revert NotAuthorized();

        a.state = State.Cancelled;
        emit Cancelled(id);
    }

    /// @notice Creador o depositante cancela un acuerdo `Created` cuyo plazo de
    ///         aceptación ya venció (limpieza de acuerdos nunca aceptados).
    function cancelExpired(uint256 id) external {
        Agreement storage a = _agreements[id];
        _requireNotTerminal(a);
        if (a.state != State.Created) revert InvalidState();
        if (msg.sender != a.creator && msg.sender != a.depositor) revert NotAuthorized();
        // forge-lint: disable-next-line(block-timestamp) — los plazos del spec son timestamps de bloque
        if (block.timestamp <= a.acceptDeadline) revert DeadlineNotPassed();

        a.state = State.Cancelled;
        emit Cancelled(id);
    }

    /// @notice El depositante fondea el acuerdo `Accepted` con `transferFrom`
    ///         del monto exacto pactado. Fondos quedan custodiados.
    function fund(uint256 id) external nonReentrant {
        Agreement storage a = _agreements[id];
        _requireNotTerminal(a);
        if (a.state != State.Accepted) revert InvalidState();
        if (msg.sender != a.depositor) revert NotDepositor();

        uint256 amount = a.deposit;
        if (token.balanceOf(msg.sender) < amount) revert InsufficientBalance();
        if (token.allowance(msg.sender, address(this)) < amount) revert InsufficientAllowance();

        // Efectos antes de la interacción (CEI).
        a.state = State.Funded;
        a.remaining = amount;

        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        // La igualdad estricta es intencional: exige acreditación exacta del
        // depósito y rechaza tokens con fee-on-transfer (no soportados).
        // forge-lint: disable-next-line(incorrect-strict-equality)
        if (token.balanceOf(address(this)) - balanceBefore != amount) revert WrongAmount();

        emit Funded(id, amount);
    }

    /// @notice Una parte propone cuánto del `remaining` va al beneficiario.
    ///         En `OutcomeProposed` sólo puede re-proponer la OTRA parte
    ///         (invalida la propuesta previa vigente).
    function proposeOutcome(uint256 id, uint256 toBeneficiary) external {
        Agreement storage a = _agreements[id];
        _requireNotTerminal(a);
        if (a.state != State.Funded && a.state != State.OutcomeProposed) revert InvalidState();
        if (msg.sender != a.depositor && msg.sender != a.beneficiary) revert NotAuthorized();
        if (a.state == State.OutcomeProposed && msg.sender == a.outcomeProposer) revert NotAuthorized();
        if (toBeneficiary > a.remaining) revert WrongAmount();

        a.outcomeProposer = msg.sender;
        a.proposedToBeneficiary = toBeneficiary;
        a.state = State.OutcomeProposed;

        emit OutcomeProposed(id, msg.sender, toBeneficiary);
    }

    /// @notice La parte que NO propuso acepta la propuesta vigente → settle
    ///         terminal: beneficiario recibe `proposedToBeneficiary` menos fee,
    ///         depositante recupera el resto.
    function acceptOutcome(uint256 id) external nonReentrant {
        Agreement storage a = _agreements[id];
        _requireNotTerminal(a);
        if (a.state != State.OutcomeProposed) revert InvalidState();
        if (msg.sender != a.depositor && msg.sender != a.beneficiary) revert NotAuthorized();
        if (msg.sender == a.outcomeProposer) revert NotAuthorized();

        uint256 toBeneficiary = a.proposedToBeneficiary;
        _settle(id, a, toBeneficiary, a.remaining - toBeneficiary);
    }

    /// @notice Cualquiera de las partes abre disputa: congela outcomes hasta
    ///         que el árbitro falle. Emite `Dispute` estilo ERC-792.
    /// @return disputeId identificador único de disputa.
    function dispute(uint256 id) external returns (uint256 disputeId) {
        Agreement storage a = _agreements[id];
        _requireNotTerminal(a);
        if (a.state != State.Funded && a.state != State.OutcomeProposed) revert InvalidState();
        if (msg.sender != a.depositor && msg.sender != a.beneficiary) revert NotAuthorized();

        disputeId = ++disputeCount;
        a.disputeId = disputeId;
        a.state = State.Disputed;

        emit Dispute(id, disputeId);
    }

    /// @notice El árbitro del acuerdo resuelve: `toBeneficiary + toDepositor`
    ///         debe ser exactamente `remaining`. Disputed → Resolved → Settled
    ///         atómico. Emite `Ruling` estilo ERC-792.
    function rule(uint256 id, uint256 toBeneficiary, uint256 toDepositor) external nonReentrant {
        Agreement storage a = _agreements[id];
        _requireNotTerminal(a);
        if (a.state != State.Disputed) revert InvalidState();
        if (msg.sender != a.arbiter) revert NotArbiter();
        if (toBeneficiary + toDepositor != a.remaining) revert SplitMismatch();

        uint8 ruling = toBeneficiary == 0 ? RULING_DEPOSITOR : toDepositor == 0 ? RULING_BENEFICIARY : RULING_SPLIT;
        a.state = State.Resolved;
        emit Ruling(a.disputeId, ruling);

        _settle(id, a, toBeneficiary, toDepositor);
    }

    /// @notice Vencido `reviewDeadline` sin disputa, el depositante recupera
    ///         todo el saldo restante (sin fee).
    function refundAfterTimeout(uint256 id) external nonReentrant {
        Agreement storage a = _agreements[id];
        _requireNotTerminal(a);
        if (a.state != State.Funded && a.state != State.OutcomeProposed) revert InvalidState();
        if (msg.sender != a.depositor) revert NotDepositor();
        // forge-lint: disable-next-line(block-timestamp) — los plazos del spec son timestamps de bloque
        if (block.timestamp <= a.reviewDeadline) revert DeadlineNotPassed();

        _settle(id, a, 0, a.remaining);
    }

    /// @notice Datos completos del acuerdo (None si el id no existe).
    function agreements(uint256 id) external view returns (Agreement memory) {
        return _agreements[id];
    }

    /// @dev Única vía de salida de fondos. Terminal: exige reparto exacto de
    ///      `remaining`, aplica fee sólo a la porción del beneficiario y deja
    ///      el acuerdo en `Settled` con `remaining = 0`.
    function _settle(uint256 id, Agreement storage a, uint256 toBeneficiary, uint256 toDepositor) private {
        if (toBeneficiary + toDepositor != a.remaining) revert SplitMismatch();

        uint256 fee = (toBeneficiary * FEE_BPS) / BPS_DENOMINATOR;
        uint256 net = toBeneficiary - fee;

        // Efectos antes de las interacciones (CEI).
        a.remaining = 0;
        a.outcomeProposer = address(0);
        a.proposedToBeneficiary = 0;
        a.state = State.Settled;

        if (fee != 0) token.safeTransfer(treasury, fee);
        if (net != 0) token.safeTransfer(a.beneficiary, net);
        if (toDepositor != 0) token.safeTransfer(a.depositor, toDepositor);

        emit Settled(id, toBeneficiary, fee, toDepositor);
    }

    /// @dev Terminales (Settled/Cancelled/Resolved) revierten AlreadySettled;
    ///      el resto de estados inesperados los valida cada transición con
    ///      InvalidState.
    function _requireNotTerminal(Agreement storage a) private view {
        if (a.state == State.Settled || a.state == State.Cancelled || a.state == State.Resolved) {
            revert AlreadySettled();
        }
    }
}
