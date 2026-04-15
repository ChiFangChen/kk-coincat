import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import type { Trip, User } from "../types";
import {
  calculateBalances,
  calculateCurrencyBreakdown,
  calculateShares,
} from "../utils/settlement";
import { formatDate } from "../utils/date";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/free-solid-svg-icons";

interface Props {
  trip: Trip;
  members: User[];
}

export function TripMyExpenses({ trip, members }: Props) {
  const { state, getTripExpenses, getUserName } = useApp();
  const currentUser = state.auth.currentUser;
  const expenses = getTripExpenses(trip.id);

  const myItems = useMemo(() => {
    if (!currentUser) return [];
    return expenses
      .filter(
        (e) =>
          e.payer === currentUser.id || e.participants.includes(currentUser.id),
      )
      .map((e) => {
        const shares = calculateShares(
          e.convertedAmount,
          e.splitMethod,
          e.participants,
          e.splitDetails,
          e.amount,
        );
        const myShare = shares[currentUser.id] || 0;
        // If I paid: I get back (total - myShare). If I didn't pay: I owe myShare.
        const delta =
          e.payer === currentUser.id ? e.convertedAmount - myShare : -myShare;
        // Original currency delta (proportional to converted delta)
        const originalDelta =
          e.convertedAmount !== 0 ? (delta / e.convertedAmount) * e.amount : 0;
        return { expense: e, myShare, delta, originalDelta };
      });
  }, [expenses, currentUser]);

  // Use the same rounded balance as settlement overview for consistency
  const total = useMemo(() => {
    if (!currentUser) return 0;
    const balances = calculateBalances(
      expenses,
      trip.members,
      trip.primaryCurrency,
    );
    return balances[currentUser.id] || 0;
  }, [expenses, trip.members, trip.primaryCurrency, currentUser]);

  const myBreakdown = useMemo(() => {
    if (!currentUser) return null;
    const bd =
      calculateCurrencyBreakdown(expenses, trip.members, trip.primaryCurrency)[
        currentUser.id
      ] || {};
    const currencies = Object.keys(bd);
    const hasNonPrimary = currencies.some((c) => c !== trip.primaryCurrency);
    if (!hasNonPrimary || currencies.length === 0) return null;
    return currencies
      .sort((a, b) =>
        a === trip.primaryCurrency
          ? -1
          : b === trip.primaryCurrency
            ? 1
            : a.localeCompare(b),
      )
      .map((cur) => {
        const entry = bd[cur];
        const sign = entry.amount > 0 ? "+" : "";
        return `${sign}${entry.amount.toLocaleString()}${cur}`;
      })
      .join(" / ");
  }, [expenses, trip.members, trip.primaryCurrency, currentUser]);

  const fmt = (iso: string) => formatDate(iso, trip.timezone);

  if (!currentUser) return null;

  return (
    <div className="page">
      {/* Total summary */}
      <div className="my-expenses-total">
        <span className="my-expenses-total-label">我的總額</span>
        <span
          className={`my-expenses-total-value ${total >= 0 ? "positive" : "negative"}`}
        >
          {total >= 0 ? "+" : ""}
          {total.toLocaleString()} {trip.primaryCurrency}
        </span>
        {myBreakdown && (
          <span className="my-expenses-total-breakdown">({myBreakdown})</span>
        )}
      </div>

      {/* Expense list */}
      {myItems.length === 0 ? (
        <div className="empty-state">
          <p>沒有與你相關的帳務</p>
        </div>
      ) : (
        <div className="expense-list">
          {myItems.map(({ expense, delta, originalDelta }) => {
            const roundedDelta = Math.round(delta * 10) / 10;
            return (
              <div
                key={expense.id}
                className={`expense-item ${expense.isSettlement ? "settlement-item" : ""}`}
              >
                <div className="expense-left">
                  <div
                    className="payer-badge"
                    style={
                      members.find((m) => m.id === expense.payer)?.color
                        ? {
                            backgroundColor: members.find(
                              (m) => m.id === expense.payer,
                            )?.color,
                          }
                        : undefined
                    }
                  >
                    {getUserName(expense.payer).charAt(0).toUpperCase()}
                  </div>
                  <div className="expense-info">
                    <div className="expense-item-name">
                      {expense.isSettlement && (
                        <FontAwesomeIcon
                          icon={faHandshake}
                          style={{ marginRight: "0.25rem", opacity: 0.6 }}
                        />
                      )}
                      {expense.item}
                    </div>
                    <div className="expense-date">
                      {fmt(expense.createdAt)}
                      {" · "}
                      {expense.payer === currentUser.id
                        ? "我付的"
                        : getUserName(expense.payer) + " 付的"}
                    </div>
                  </div>
                </div>
                <div className="expense-right">
                  <div>
                    {expense.currency !== trip.primaryCurrency ? (
                      <>
                        <div
                          className={`expense-amount ${roundedDelta >= 0 ? "positive" : "negative"}`}
                        >
                          {Math.round(originalDelta * 10) / 10 >= 0 ? "+" : ""}
                          {(
                            Math.round(originalDelta * 10) / 10
                          ).toLocaleString()}{" "}
                          {expense.currency}
                        </div>
                        <div className="expense-converted">
                          ≈ {roundedDelta >= 0 ? "+" : ""}
                          {roundedDelta.toLocaleString()} {trip.primaryCurrency}
                        </div>
                      </>
                    ) : (
                      <div
                        className={`expense-amount ${roundedDelta >= 0 ? "positive" : "negative"}`}
                      >
                        {roundedDelta >= 0 ? "+" : ""}
                        {roundedDelta.toLocaleString()} {trip.primaryCurrency}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
