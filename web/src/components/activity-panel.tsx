"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ThinkingOrb } from "thinking-orbs";
import {
  Activity01Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Database01Icon,
  File01Icon,
  Link01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "../lib/utils";
import type { AssistantArtifact } from "../lib/assistant-output";
import type { UiToolCall } from "../lib/types";
import {
  buildActivityModel,
  type ActivityIcon,
  type ActivityResource,
  type ActivityStep,
} from "../lib/activity-model";
import { activityVisualTokens } from "../lib/ui-tokens";
import { ActivityDrawer } from "./activity-drawer";
import { ThinkingIndicator } from "./thinking-indicator";

interface ActivityPanelProps {
  artifacts: AssistantArtifact[];
  hasVisibleContent: boolean;
  latencyMs?: number;
  streaming: boolean;
  toolCalls: UiToolCall[];
  onApprove?(): void;
  onDeny?(): void;
}

function ProcessTimeline({
  steps,
  onApprove,
  onDeny,
}: {
  steps: ActivityStep[];
  onApprove?(): void;
  onDeny?(): void;
}) {
  return (
    <ol className="activity-timeline">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isRunning = step.status === "running";
        const isApproval = step.status === "approval";
        const isError = step.status === "error";
        const usesThinkingDot = step.id === "active";

        return (
          <li key={step.id} className="activity-row">
            {!isLast && <span aria-hidden="true" className="activity-connector" />}
            <span
              data-thinking={usesThinkingDot ? "true" : undefined}
              className={cn(
                "activity-icon-slot bg-background text-muted-foreground/75",
                !usesThinkingDot && "mt-px",
                step.status === "done" && "text-foreground/82",
                isError && "text-destructive",
                isApproval && "text-amber-300/90",
              )}
            >
              {usesThinkingDot && !isError ? (
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              ) : (
                <HugeiconsIcon
                  icon={isError ? AlertCircleIcon : step.icon}
                  size={activityVisualTokens.icon.size}
                  color="currentColor"
                  strokeWidth={activityVisualTokens.icon.strokeWidth}
                  aria-hidden="true"
                />
              )}
            </span>
            <div className="min-w-0 pt-px">
              {isRunning ? (
                <ThinkingIndicator label={step.label} />
              ) : (
                <p className="activity-label">{step.label}</p>
              )}
              {step.detail && <p className="activity-detail">{step.detail}</p>}
              {isApproval && onApprove && onDeny && (
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onApprove}
                    className="rounded-md bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 active:translate-y-px"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={onDeny}
                    className="rounded-md px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground active:translate-y-px"
                  >
                    Deny
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ResourceGroup({
  title,
  items,
  icon,
}: {
  title: string;
  items: ActivityResource[];
  icon: ActivityIcon;
}) {
  if (items.length === 0) return null;

  return (
    <section className="activity-resource-group mt-8">
      <h4 className="activity-section-title">
        {title} <span className="text-muted-foreground/45">· {items.length}</span>
      </h4>
      <div className="mt-4 space-y-5">
        {items.map((item) => (
          <div key={item.id} className="activity-row pb-0">
            <span className="activity-icon-slot mt-px text-muted-foreground/70">
              <HugeiconsIcon
                icon={icon}
                size={activityVisualTokens.resourceIcon.size}
                color="currentColor"
                strokeWidth={activityVisualTokens.resourceIcon.strokeWidth}
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0">
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="activity-resource-label line-clamp-1 underline-offset-4 hover:underline"
                >
                  {item.label}
                </a>
              ) : (
                <p className="activity-resource-label line-clamp-1">{item.label}</p>
              )}
              {item.detail && (
                <p className="activity-resource-detail line-clamp-2">{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActivityPanel({
  artifacts,
  hasVisibleContent,
  latencyMs,
  streaming,
  toolCalls,
  onApprove,
  onDeny,
}: ActivityPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const previousStreaming = React.useRef(streaming);

  const model = React.useMemo(
    () => buildActivityModel({
      artifacts,
      hasVisibleContent,
      latencyMs,
      streaming,
      toolCalls,
    }),
    [artifacts, hasVisibleContent, latencyMs, streaming, toolCalls],
  );

  React.useEffect(() => {
    if (previousStreaming.current && !streaming) setOpen(false);
    previousStreaming.current = streaming;
  }, [streaming]);

  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  return (
    <section className="activity-container not-prose mb-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "activity-trigger group -ml-1 inline-flex items-center gap-2 rounded-sm py-1 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-4 focus-visible:ring-offset-background",
        )}
      >
        {streaming ? (
          <>
            <ThinkingOrb
              state="working"
              size={activityVisualTokens.thinkingOrb.size}
              speed={activityVisualTokens.thinkingOrb.speed}
              aria-hidden="true"
              className="shrink-0"
            />
            <ThinkingIndicator label={model.activeLabel} level="heading" />
          </>
        ) : (
          <span className="activity-trigger-label tabular-nums">{model.completedLabel}</span>
        )}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={activityVisualTokens.triggerIcon.size}
          color="currentColor"
          strokeWidth={activityVisualTokens.triggerIcon.strokeWidth}
          aria-hidden="true"
          className={cn(
            "activity-trigger-icon text-muted-foreground/50 transition-transform group-hover:text-muted-foreground",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="activity-reveal animate-in fade-in slide-in-from-top-1">
          <ProcessTimeline
            steps={model.steps}
            onApprove={onApprove}
            onDeny={onDeny}
          />
          <ResourceGroup title="Memory" items={model.memoryItems} icon={Database01Icon} />
          <ResourceGroup title="Sources" items={model.sourceItems} icon={Link01Icon} />
          <ResourceGroup title="Files" items={model.fileItems} icon={File01Icon} />

          {model.hasObservableWork && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="activity-open-details group/details"
            >
              <span className="inline-flex items-center gap-2">
                <HugeiconsIcon
                  icon={Activity01Icon}
                  size={15}
                  color="currentColor"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                Open activity
              </span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.6}
                aria-hidden="true"
                className="transition-transform group-hover/details:translate-x-0.5"
              />
            </button>
          )}
        </div>
      )}

      <ActivityDrawer
        durationLabel={model.durationLabel}
        fileItems={model.fileItems}
        memoryItems={model.memoryItems}
        onClose={closeDrawer}
        open={drawerOpen}
        sourceItems={model.sourceItems}
        steps={model.steps}
        streaming={streaming}
      />
    </section>
  );
}
