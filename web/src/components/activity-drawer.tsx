"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity01Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  Cancel01Icon,
  CodeIcon,
  Database01Icon,
  File01Icon,
  Link01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "../lib/utils";
import {
  activityStatusLabel,
  formatActivityPayload,
  formatToolDuration,
  type ActivityResource,
  type ActivityStep,
} from "../lib/activity-model";
import { activityVisualTokens } from "../lib/ui-tokens";
import { ThinkingIndicator } from "./thinking-indicator";

interface ActivityDrawerProps {
  durationLabel?: string;
  fileItems: ActivityResource[];
  memoryItems: ActivityResource[];
  onClose(): void;
  open: boolean;
  sourceItems: ActivityResource[];
  steps: ActivityStep[];
  streaming: boolean;
}

function ToolPayload({ label, value }: { label: string; value: unknown }) {
  const payload = formatActivityPayload(value);
  if (!payload) return null;

  return (
    <section>
      <h5 className="activity-payload-label">{label}</h5>
      <pre className="activity-payload-code">
        <code>{payload}</code>
      </pre>
    </section>
  );
}

function ToolDetails({ step }: { step: ActivityStep }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="activity-tool-details">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-1.5">
          <HugeiconsIcon
            icon={CodeIcon}
            size={13}
            color="currentColor"
            strokeWidth={1.6}
            aria-hidden="true"
          />
          Tool details
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={13}
          color="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
          className={cn(
            "transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="activity-reveal mt-3 space-y-3 animate-in fade-in slide-in-from-top-1">
          <ToolPayload label="Input" value={step.toolCall?.input} />
          <ToolPayload label="Output" value={step.toolCall?.output} />
        </div>
      )}
    </div>
  );
}

function DrawerStep({ step }: { step: ActivityStep }) {
  const isRunning = step.status === "running";
  const isError = step.status === "error";
  const hasPayload = step.toolCall?.input !== undefined || step.toolCall?.output !== undefined;
  const toolDuration = step.toolCall ? formatToolDuration(step.toolCall) : undefined;

  return (
    <li className="activity-drawer-step">
      <span
        className={cn(
          "activity-drawer-step-icon",
          isError && "text-destructive",
          step.status === "done" && "text-foreground/80",
        )}
      >
        <HugeiconsIcon
          icon={isError ? AlertCircleIcon : step.icon}
          size={activityVisualTokens.icon.size}
          color="currentColor"
          strokeWidth={activityVisualTokens.icon.strokeWidth}
          aria-hidden="true"
        />
      </span>

      <div className="min-w-0">
        {isRunning ? (
          <ThinkingIndicator label={step.label} />
        ) : (
          <p className="activity-drawer-step-label">{step.label}</p>
        )}

        {step.detail && <p className="activity-drawer-step-detail">{step.detail}</p>}

        <p className="activity-drawer-step-meta">
          {activityStatusLabel(step.status)}
          {toolDuration ? ` · ${toolDuration}` : ""}
        </p>

        {hasPayload && <ToolDetails step={step} />}
      </div>
    </li>
  );
}

function DrawerResources({
  icon,
  items,
  title,
}: {
  icon: typeof File01Icon;
  items: ActivityResource[];
  title: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="activity-drawer-resource-section">
      <h4 className="activity-drawer-section-title">
        {title} <span>· {items.length}</span>
      </h4>
      <div className="mt-3 space-y-3.5">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-3">
            <span className="activity-icon-slot mt-px text-muted-foreground/65">
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
                  className="activity-drawer-resource-label hover:text-foreground"
                >
                  {item.label}
                </a>
              ) : (
                <p className="activity-drawer-resource-label">{item.label}</p>
              )}
              {item.detail && <p className="activity-drawer-resource-detail">{item.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActivityDrawer({
  durationLabel,
  fileItems,
  memoryItems,
  onClose,
  open,
  sourceItems,
  steps,
  streaming,
}: ActivityDrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  const drawerRef = React.useRef<HTMLElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close activity"
        className="activity-drawer-backdrop"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-drawer-title"
        className="activity-drawer"
      >
        <header className="activity-drawer-header">
          <div className="flex min-w-0 items-center gap-2">
            <HugeiconsIcon
              icon={Activity01Icon}
              size={16}
              color="currentColor"
              strokeWidth={1.6}
              aria-hidden="true"
              className="text-muted-foreground/75"
            />
            <h3 id="activity-drawer-title" className="truncate text-sm font-medium text-foreground/90">
              Activity
            </h3>
            <span className="text-sm text-muted-foreground/45">·</span>
            <span className="truncate text-sm tabular-nums text-muted-foreground/65">
              {streaming ? "In progress" : durationLabel ?? "Complete"}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="activity-drawer-close"
            aria-label="Close activity panel"
            title="Close activity"
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              size={17}
              color="currentColor"
              strokeWidth={1.65}
              aria-hidden="true"
            />
          </button>
        </header>

        <div className="activity-drawer-scroll">
          <section aria-labelledby="activity-work-title">
            <h4 id="activity-work-title" className="activity-drawer-section-title">
              Work <span>· {steps.length}</span>
            </h4>
            <ol className="activity-drawer-timeline">
              {steps.map((step) => <DrawerStep key={step.id} step={step} />)}
            </ol>
          </section>

          <DrawerResources title="Memory" items={memoryItems} icon={Database01Icon} />
          <DrawerResources title="Sources" items={sourceItems} icon={Link01Icon} />
          <DrawerResources title="Files" items={fileItems} icon={File01Icon} />
        </div>
      </aside>
    </>,
    document.body,
  );
}
