"use client"

import { AlertTriangle, Info, ReceiptText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { TaxPreview as TaxPreviewData } from "@/lib/tax"

type Props = {
  preview?: TaxPreviewData | null
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function TaxPreview({ preview }: Props) {
  if (!preview || preview.lines.length === 0) return null

  const shortTermGain = preview.lines
    .filter((line) => line.holdingPeriod === "short-term")
    .reduce((sum, line) => sum + line.realizedGain, 0)
  const longTermGain = preview.lines
    .filter((line) => line.holdingPeriod === "long-term")
    .reduce((sum, line) => sum + line.realizedGain, 0)
  const shortTermTax = preview.lines
    .filter((line) => line.holdingPeriod === "short-term")
    .reduce((sum, line) => sum + line.estimatedTax, 0)
  const longTermTax = preview.lines
    .filter((line) => line.holdingPeriod === "long-term")
    .reduce((sum, line) => sum + line.estimatedTax, 0)

  return (
    <Card className="border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ReceiptText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Tax Preview
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Tax preview details"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Simplified federal estimate. Actual taxes depend on your bracket,
              state, filing status, losses, and other tax rules.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Realized gain/loss</p>
            <p className="text-2xl font-bold text-foreground">
              {currency.format(preview.totalRealizedGain)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Estimated federal tax
            </p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {currency.format(preview.estimatedFederalTax)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-md border bg-background/70 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Short-term gain
            </p>
            <p className="font-semibold text-foreground">
              {currency.format(shortTermGain)}
            </p>
            <p className="text-xs text-muted-foreground">
              approx. {currency.format(shortTermTax)} tax at 22%
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Long-term gain
            </p>
            <p className="font-semibold text-foreground">
              {currency.format(longTermGain)}
            </p>
            <p className="text-xs text-muted-foreground">
              approx. {currency.format(longTermTax)} tax at 15%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {preview.lines.map((line) => (
            <div
              key={line.ticker}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/70 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-mono font-medium text-foreground">
                  {line.ticker}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sell {line.sharesSold.toLocaleString()} shares,{" "}
                  {line.holdingPeriod} at {(line.taxRate * 100).toFixed(0)}%
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-foreground">
                  {currency.format(line.estimatedTax)}
                </p>
                <p className="text-xs text-muted-foreground">
                  gain {currency.format(line.realizedGain)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Simplified federal estimate. Actual taxes depend on bracket/state.
        </p>

        {preview.warnings.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            {preview.warnings.map((warning) => (
              <p
                key={warning}
                className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{warning}</span>
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
