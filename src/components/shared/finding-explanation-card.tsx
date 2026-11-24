"use client";

import * as React from "react";
import type { ExplainedFinding } from "@/lib/explanations/engine";
import { ChevronDown, ChevronRight, ExternalLink, Info } from "lucide-react";

interface FindingExplanationCardProps {
  explained: ExplainedFinding;
}

export function FindingExplanationCard({ explained }: FindingExplanationCardProps) {
  const [showTechnical, setShowTechnical] = React.useState(false);

  return (
    <div className="mt-3 space-y-2.5 text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
          <div className="font-semibold text-foreground mb-0.5">1. What happened?</div>
          <p className="text-muted-foreground leading-relaxed">{explained.whatHappened}</p>
        </div>
        <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
          <div className="font-semibold text-foreground mb-0.5">2. Why does it matter?</div>
          <p className="text-muted-foreground leading-relaxed">{explained.whyItMatters}</p>
        </div>
        <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
          <div className="font-semibold text-foreground mb-0.5">3. What could happen?</div>
          <p className="text-muted-foreground leading-relaxed">{explained.whatCouldHappen}</p>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <div className="font-semibold text-foreground mb-0.5">4. How can I fix it?</div>
          <p className="text-muted-foreground leading-relaxed">{explained.howToFix}</p>
        </div>
      </div>

      {/* Collapsible Technical Details */}
      <div className="rounded-md border border-border/50 bg-muted/10">
        <button
          type="button"
          onClick={() => setShowTechnical((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            {showTechnical ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Info className="h-3 w-3" />
            Technical Details ({explained.ruleId})
          </span>
          <span>Source: {explained.detectionSource}</span>
        </button>

        {showTechnical && (
          <div className="border-t border-border/50 px-3 py-2.5 space-y-1.5 font-mono text-[11px] text-muted-foreground">
            <div>
              <span className="text-foreground">Technical Output:</span>{" "}
              {explained.technicalDetails}
            </div>
            {explained.affectedTarget && (
              <div>
                <span className="text-foreground">Affected Resource:</span>{" "}
                {explained.affectedTarget}
              </div>
            )}
            {explained.timestamp && (
              <div>
                <span className="text-foreground">Detected At:</span>{" "}
                {new Date(explained.timestamp).toLocaleString()}
              </div>
            )}
            {explained.documentationUrl && (
              <div>
                <a
                  href={explained.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Documentation <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
