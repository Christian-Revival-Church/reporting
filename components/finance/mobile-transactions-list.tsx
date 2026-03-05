"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileBottomSheet } from "@/components/ui/mobile-bottom-sheet";

type TransactionListItem = {
  id: string;
  date: string;
  financeType: string;
  memberName: string;
  serviceTitle: string;
  paymentMethod: string;
  capturedBy: string;
  amountLabel: string;
};

type MobileTransactionsListProps = {
  transactions: TransactionListItem[];
};

export function MobileTransactionsList({ transactions }: MobileTransactionsListProps) {
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);
  const activeTransaction = useMemo(
    () => transactions.find((item) => item.id === activeTransactionId) ?? null,
    [activeTransactionId, transactions],
  );

  return (
    <>
      <div className="space-y-2 md:hidden">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{transaction.amountLabel}</p>
              <p className="text-xs text-slate-500">{transaction.date}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => setActiveTransactionId(transaction.id)}
            >
              View more
            </Button>
          </div>
        ))}
      </div>

      <MobileBottomSheet
        open={Boolean(activeTransaction)}
        title={activeTransaction ? activeTransaction.amountLabel : "Transaction"}
        onClose={() => setActiveTransactionId(null)}
      >
        {activeTransaction ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Date:</span> {activeTransaction.date}
            </p>
            <p>
              <span className="font-medium text-slate-900">Type:</span> <Badge>{activeTransaction.financeType}</Badge>
            </p>
            <p>
              <span className="font-medium text-slate-900">Member:</span> {activeTransaction.memberName}
            </p>
            <p>
              <span className="font-medium text-slate-900">Service:</span> {activeTransaction.serviceTitle}
            </p>
            <p>
              <span className="font-medium text-slate-900">Method:</span> {activeTransaction.paymentMethod}
            </p>
            <p>
              <span className="font-medium text-slate-900">Captured by:</span> {activeTransaction.capturedBy}
            </p>
          </div>
        ) : null}
      </MobileBottomSheet>
    </>
  );
}
