"use client";

import { useState } from "react";
import UpgradeDialog, { type PlanCard } from "../UpgradeDialog";

export type { PlanCard };

export default function UpgradePlanButton({
  currentSlug,
  plans,
}: {
  currentSlug: string;
  plans: PlanCard[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 border border-foreground bg-foreground px-4 py-2 text-xs text-background transition-opacity hover:opacity-85"
      >
        Upgrade →
      </button>
      <UpgradeDialog
        open={open}
        onClose={() => setOpen(false)}
        currentSlug={currentSlug}
        plans={plans}
      />
    </>
  );
}
