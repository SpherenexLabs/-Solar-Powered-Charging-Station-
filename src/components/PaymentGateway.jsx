import { useMemo, useState } from "react";
import { makeTxnId } from "../lib/solarConfig";

/* ══════════════════════════════════════════════════════════════
   Simulated payment gateway — UPI / Card / Net Banking / Wallet.

   This is a demo checkout for the project: no money moves and no real
   credentials are stored. Card numbers are masked to the last 4 digits
   before anything is written to Firebase, and no banking password is
   ever requested.
══════════════════════════════════════════════════════════════ */

const METHODS = [
  { id: "upi", label: "UPI", icon: "🟣", note: "GPay · PhonePe · Paytm · BHIM" },
  { id: "card", label: "Card", icon: "💳", note: "Credit / Debit / ATM card" },
  { id: "netbanking", label: "Net Banking", icon: "🏦", note: "All major Indian banks" },
  { id: "wallet", label: "Wallet", icon: "👛", note: "Paytm · PhonePe · Amazon Pay" }
];

const BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "IndusInd Bank"
];

const WALLETS = ["Paytm Wallet", "PhonePe Wallet", "Amazon Pay", "Mobikwik", "Freecharge"];

const UPI_APPS = ["Google Pay", "PhonePe", "Paytm", "BHIM UPI", "Amazon Pay UPI"];

function groupCard(value) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function PaymentGateway({ open, summary, amount, onCancel, onSuccess }) {
  const [method, setMethod] = useState("upi");
  const [stage, setStage] = useState("form"); // form | processing | done
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  /* UPI */
  const [upiApp, setUpiApp] = useState(UPI_APPS[0]);
  const [upiId, setUpiId] = useState("");

  /* Card */
  const [cardName, setCardName] = useState("");
  const [cardNo, setCardNo] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  /* Net banking */
  const [bank, setBank] = useState(BANKS[0]);
  const [customerId, setCustomerId] = useState("");

  /* Wallet */
  const [wallet, setWallet] = useState(WALLETS[0]);
  const [walletMobile, setWalletMobile] = useState("");
  const [walletOtp, setWalletOtp] = useState("");

  const methodLabel = useMemo(
    () => METHODS.find((m) => m.id === method)?.label || "",
    [method]
  );

  if (!open) return null;

  /* ── Validation per payment method ── */
  function validate() {
    if (method === "upi") {
      if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId.trim()))
        return "Enter a valid UPI ID (example: name@okhdfcbank).";
      return "";
    }

    if (method === "card") {
      const digits = cardNo.replace(/\D/g, "");
      if (!cardName.trim()) return "Enter the name printed on the card.";
      if (digits.length !== 16) return "Card number must be 16 digits.";
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExp)) return "Expiry must be in MM/YY format.";
      if (!/^\d{3}$/.test(cardCvv)) return "CVV must be 3 digits.";
      return "";
    }

    if (method === "netbanking") {
      if (customerId.trim().length < 4) return "Enter your bank customer / user ID.";
      return "";
    }

    if (method === "wallet") {
      if (!/^\d{10}$/.test(walletMobile.trim())) return "Enter the 10-digit wallet mobile number.";
      if (!/^\d{4,6}$/.test(walletOtp.trim())) return "Enter the OTP sent to your mobile.";
      return "";
    }

    return "";
  }

  /* ── Payment details that are safe to persist ── */
  function buildDetails() {
    if (method === "upi") return { paymentMethod: `UPI · ${upiApp}`, paymentRef: upiId.trim() };

    if (method === "card") {
      const digits = cardNo.replace(/\D/g, "");
      const brand = digits.startsWith("4")
        ? "VISA"
        : digits.startsWith("5")
        ? "MasterCard"
        : "RuPay";
      return {
        paymentMethod: `Card · ${brand}`,
        paymentRef: `XXXX XXXX XXXX ${digits.slice(-4)}`
      };
    }

    if (method === "netbanking")
      return {
        paymentMethod: `Net Banking · ${bank}`,
        paymentRef: `CUST-${customerId.trim().slice(-4)}`
      };

    return {
      paymentMethod: `Wallet · ${wallet}`,
      paymentRef: `+91 ${walletMobile.slice(0, 2)}XXXXXX${walletMobile.slice(-2)}`
    };
  }

  function handlePay() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError("");
    setStage("processing");

    /* Simulated bank round-trip */
    setTimeout(() => {
      const result = {
        ...buildDetails(),
        txnId: makeTxnId(),
        amount,
        paymentStatus: "Paid",
        paidAt: new Date().toISOString()
      };
      setReceipt(result);
      setStage("done");
    }, 2200);
  }

  return (
    <div className="popup pay-popup">
      <div className="pay-box">
        {/* ── Header ── */}
        <div className="pay-head">
          <div className="pay-head-left">
            <div className="pay-logo">⚡</div>
            <div>
              <h2>SolarHub Checkout</h2>
              <span>Secure payment · Demo mode</span>
            </div>
          </div>
          <div className="pay-amount">
            <span>Amount payable</span>
            <strong>₹{amount}</strong>
          </div>
        </div>

        <div className="pay-demo-note">
          Simulated gateway for this project — no real money is transferred. Please do not
          enter genuine card or bank details.
        </div>

        {/* ── Processing ── */}
        {stage === "processing" && (
          <div className="pay-processing">
            <div className="pay-spinner" />
            <h3>Contacting {methodLabel} gateway…</h3>
            <p>Do not press back or close this window.</p>
          </div>
        )}

        {/* ── Success receipt ── */}
        {stage === "done" && receipt && (
          <div className="pay-success">
            <div className="pay-tick">✓</div>
            <h3>Payment Successful</h3>
            <p className="pay-success-amt">₹{receipt.amount}</p>

            <div className="pay-receipt">
              <div>
                <span>Transaction ID</span>
                <strong>{receipt.txnId}</strong>
              </div>
              <div>
                <span>Method</span>
                <strong>{receipt.paymentMethod}</strong>
              </div>
              <div>
                <span>Paid using</span>
                <strong>{receipt.paymentRef}</strong>
              </div>
              {summary?.map((row) => (
                <div key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>

            <button className="pay-submit" onClick={() => onSuccess(receipt)}>
              Confirm and Start Charging
            </button>
          </div>
        )}

        {/* ── Method picker + form ── */}
        {stage === "form" && (
          <>
            <div className="pay-body">
              <div className="pay-methods">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pay-method ${method === m.id ? "active" : ""}`}
                    onClick={() => {
                      setMethod(m.id);
                      setError("");
                    }}
                  >
                    <span className="pay-method-icon">{m.icon}</span>
                    <span className="pay-method-text">
                      <strong>{m.label}</strong>
                      <small>{m.note}</small>
                    </span>
                  </button>
                ))}
              </div>

              <div className="pay-fields">
                {summary?.length > 0 && (
                  <div className="pay-order">
                    {summary.map((row) => (
                      <div key={row.label}>
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {method === "upi" && (
                  <>
                    <label>UPI App</label>
                    <select value={upiApp} onChange={(e) => setUpiApp(e.target.value)}>
                      {UPI_APPS.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>

                    <label>UPI ID</label>
                    <input
                      placeholder="yourname@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                    <p className="pay-hint">
                      A collect request will be raised on your UPI app for ₹{amount}.
                    </p>
                  </>
                )}

                {method === "card" && (
                  <>
                    <label>Name on Card</label>
                    <input
                      placeholder="Card holder name"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                    />

                    <label>Card Number</label>
                    <input
                      inputMode="numeric"
                      placeholder="4111 1111 1111 1111"
                      value={cardNo}
                      onChange={(e) => setCardNo(groupCard(e.target.value))}
                    />

                    <div className="pay-row">
                      <div>
                        <label>Expiry</label>
                        <input
                          inputMode="numeric"
                          placeholder="MM/YY"
                          value={cardExp}
                          onChange={(e) => setCardExp(formatExpiry(e.target.value))}
                        />
                      </div>
                      <div>
                        <label>CVV</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          placeholder="123"
                          maxLength={3}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                    </div>
                    <p className="pay-hint">
                      Only the last 4 digits are stored with the booking.
                    </p>
                  </>
                )}

                {method === "netbanking" && (
                  <>
                    <label>Select Bank</label>
                    <select value={bank} onChange={(e) => setBank(e.target.value)}>
                      {BANKS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>

                    <label>Customer / User ID</label>
                    <input
                      placeholder="Net banking user ID"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                    />
                    <p className="pay-hint">
                      You will be taken to the {bank} authorisation page. Your password is
                      never entered here.
                    </p>
                  </>
                )}

                {method === "wallet" && (
                  <>
                    <label>Select Wallet</label>
                    <select value={wallet} onChange={(e) => setWallet(e.target.value)}>
                      {WALLETS.map((w) => (
                        <option key={w}>{w}</option>
                      ))}
                    </select>

                    <label>Registered Mobile Number</label>
                    <input
                      inputMode="numeric"
                      placeholder="10-digit mobile number"
                      value={walletMobile}
                      onChange={(e) =>
                        setWalletMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                    />

                    <label>OTP</label>
                    <input
                      inputMode="numeric"
                      placeholder="Enter OTP"
                      value={walletOtp}
                      onChange={(e) =>
                        setWalletOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                    />
                    <p className="pay-hint">Demo OTP: enter any 4 to 6 digits.</p>
                  </>
                )}

                {error && <div className="pay-error">{error}</div>}
              </div>
            </div>

            <div className="pay-actions">
              <button className="pay-cancel" type="button" onClick={onCancel}>
                Cancel
              </button>
              <button className="pay-submit" type="button" onClick={handlePay}>
                Pay ₹{amount}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentGateway;
