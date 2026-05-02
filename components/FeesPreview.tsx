"use client"

import { Info, ReceiptText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { FeeEstimate } from "@/lib/fees"

type Props = {
  estimate?: FeeEstimate | null
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

export function FeesPreview({ estimate }: Props) {
  if (!estimate || estimate.totalTradedValue <= 0) return null

  return (
    <Card className="border-[#e0e0e0] border-l-4 border-l-[#5bb5a2] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-[#002141]">
          <ReceiptText className="h-5 w-5 text-[#00735f]" />
          Fees & Costs
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-full text-[#43474f] hover:text-[#002141]"
                aria-label="Fees and costs details"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Estimate assumes $0 commissions and 0.05% spread/slippage on
              non-mutual-fund trades.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-[#43474f]">
              Total traded value
            </p>
            <p className="text-2xl font-semibold text-[#002141]">
              {currency.format(estimate.totalTradedValue)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-[#43474f]">
              Estimated trading cost
            </p>
            <p className="text-2xl font-semibold text-[#00735f]">
              {currency.format(estimate.totalCost)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-md border border-[#e0e0e0] bg-[#f9f9fe] p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-[#43474f]">Commission</p>
            <p className="font-semibold text-[#002141]">
              {currency.format(estimate.commission)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#43474f]">
              Spread/slippage
            </p>
            <p className="font-semibold text-[#002141]">
              {currency.format(estimate.spreadSlippage)}
            </p>
          </div>
        </div>

        <p className="text-xs text-[#43474f]">
          This is a simplified estimate, not a broker quote. Actual execution
          prices, spreads, fund fees, taxes, and broker-specific charges can
          differ.
        </p>
      </CardContent>
    </Card>
  )
}
