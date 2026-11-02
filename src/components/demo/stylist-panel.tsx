"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { VoiceInput } from "@/components/voice-input";
import { findDemoProduct, itemProductId, money } from "@/lib/demo/catalog";
import { productCover } from "@/lib/demo/albums";
import {
  shoppingResultSchema,
  stylistInputSchema,
  type ShoppingResult,
  type ShoppingOption,
  type StylistInput,
} from "@/lib/shopping/contracts";
import { merchandiseTotal, purchaseLines } from "@/lib/shopping/engine";
import type { Arrangement } from "@/lib/demo/state";
import models from "@/lib/demo/catalog-models.json";
import { canonicalJson } from "@/lib/shopping/canonical";

export function StylistPanel({
  sceneId,
  draft,
  selected,
  onPreview,
  onApply,
  onOwned,
  previewActive,
}: {
  sceneId: string;
  draft: Arrangement;
  selected: string;
  onPreview: (draft: Arrangement | null) => void;
  onApply: (option: ShoppingOption) => void;
  onOwned: (id: string, owned: boolean) => void;
  previewActive: boolean;
}) {
  const [text, setText] = useState(
      "Make this space warmer and coordinate the finishes.",
    ),
    [budget, setBudget] = useState(
      sceneId === "corner"
        ? "500"
        : sceneId === "space"
          ? "800"
          : String(
              Math.max(100, Math.ceil(merchandiseTotal(draft) / 10000) * 100),
            ),
    ),
    [keep, setKeep] = useState<string[]>(selected ? [selected] : []),
    [voice, setVoice] = useState<string | undefined>(),
    [id, setId] = useState(""),
    [phase, setPhase] = useState(""),
    [result, setResult] = useState<ShoppingResult | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [working, setWorking] = useState(""),
    [preview, setPreview] = useState(""),
    [recover, setRecover] = useState(false);
  const [submitted, setSubmitted] = useState<StylistInput | null>(null);
  const current = useRef(draft),
    alive = useRef(true);
  useEffect(() => {
    current.current = draft;
  }, [draft]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    async function restore() {
      try {
        const cached = JSON.parse(
          sessionStorage.getItem(`rescene-stylist-${sceneId}`) ?? "null",
        );
        if (!cached) return;
        const input = stylistInputSchema.parse(cached.input);
        if (input.sceneId !== sceneId) return;
        await Promise.resolve();
        if (disposed) return;
        setSubmitted(input);
        setText(input.text);
        setBudget(String(input.budgetCents / 100));
        setKeep(input.keep);
        if (typeof cached.id === "string" && /^[a-f\d-]{36}$/.test(cached.id)) {
          setId(cached.id);
          setBusy(true);
          setPhase("QUEUED");
        } else setRecover(true);
      } catch {
        /* Session storage is optional; the accepted arrangement is unaffected. */
      }
    }
    void restore();
    return () => {
      disposed = true;
    };
  }, [sceneId]);
  const subtotalInput = /^\d{1,6}(\.\d{1,2})?$/.test(budget)
    ? Math.round(Number(budget) * 100)
    : 0;
  const stale =
    !!submitted &&
    (canonicalJson(draft) !== canonicalJson(submitted.draft) ||
      text !== submitted.text ||
      subtotalInput !== submitted.budgetCents ||
      canonicalJson(keep) !== canonicalJson(submitted.keep));
  const applied = result?.options.find(
    (o) => canonicalJson(o.draft) === canonicalJson(draft),
  );
  useEffect(() => {
    if (!id || !busy) return;
    let disposed = false;
    const pollingStarted = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/voice/stylist/${id}`, {
            cache: "no-store",
          }),
          data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error?.message ?? "The saved request could not be retrieved.",
          );
        if (disposed) return;
        setPhase(data.phase);
        if (
          (data.status === "PENDING" || data.status === "WAITING") &&
          Date.now() - pollingStarted > 20000
        ) {
          setError(
            "Your request is saved but has not started. Check the saved request to dispatch it again safely.",
          );
          setBusy(false);
          setRecover(true);
          return;
        }
        if (data.status === "SUCCEEDED") {
          setResult(shoppingResultSchema.parse(data.result));
          setBusy(false);
          setRecover(false);
          return;
        }
        if (["FAILED", "SUBMISSION_UNCERTAIN"].includes(data.status)) {
          setError(
            data.error ??
              "This request could not finish. Your scene is unchanged.",
          );
          setBusy(false);
          return;
        }
        timer = setTimeout(poll, 1500);
      } catch (e) {
        if (!disposed) {
          setError(
            e instanceof Error ? e.message : "The connection was interrupted.",
          );
          setBusy(false);
          setRecover(true);
        }
      }
    }
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [id, busy]);
  async function suggest(retrieve = false) {
    if (retrieve && id && phase !== "QUEUED" && phase !== "CHECKING") {
      setError("");
      setBusy(true);
      return;
    }
    const request =
      retrieve && submitted
        ? submitted
        : {
            key: crypto.randomUUID(),
            sceneId: sceneId as StylistInput["sceneId"],
            text,
            budgetCents: subtotalInput,
            selected,
            keep,
            draft,
            ...(voice ? { voiceAttemptId: voice } : {}),
          };
    setSubmitted(request);
    try {
      sessionStorage.setItem(
        `rescene-stylist-${sceneId}`,
        JSON.stringify({ input: request, id: null }),
      );
    } catch {}
    setId("");
    setBusy(true);
    setResult(null);
    setError("");
    setPhase("QUEUED");
    setPreview("");
    onPreview(null);
    try {
      const response = await fetch("/api/voice/stylist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        }),
        data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message ?? "The stylist could not start.");
      if (alive.current) {
        setId(data.id);
        try {
          sessionStorage.setItem(
            `rescene-stylist-${sceneId}`,
            JSON.stringify({ input: request, id: data.id }),
          );
        } catch {}
        setRecover(false);
      }
    } catch (e) {
      if (alive.current) {
        setError(
          e instanceof Error ? e.message : "The request was interrupted.",
        );
        setBusy(false);
        setRecover(true);
      }
    }
  }
  async function prepare(option: ShoppingOption, apply: boolean) {
    if (stale || busy || working) return;
    setWorking(option.id);
    setError("");
    const original = canonicalJson(draft);
    try {
      // Warm browser cache and validate the actual allowlisted mesh before replacing the accepted view.
      const changed = Object.entries(option.draft.items)
        .filter(
          ([slot, item]) =>
            itemProductId(slot, item) !==
            itemProductId(slot, draft.items[slot]),
        )
        .map(([slot, item]) => itemProductId(slot, item));
      await Promise.all(
        [...new Set(changed)].map(async (productId) => {
          const m = models.find((m) => m.id === productId);
          if (!m) throw new Error("A product model is unavailable.");
          const r = await fetch(
            `/api/demo/assets/${productId}?v=${m.digest.slice(0, 12)}`,
          );
          if (!r.ok)
            throw new Error(
              "A product model could not load. Your accepted scene is kept.",
            );
          const bytes = await r.arrayBuffer();
          if (
            bytes.byteLength > 16 * 1024 * 1024 ||
            bytes.byteLength < 12 ||
            new DataView(bytes).getUint32(0, true) !== 0x46546c67
          )
            throw new Error("A product model could not be validated.");
        }),
      );
      if (original !== canonicalJson(current.current))
        throw new Error(
          "Your scene changed while loading. Request fresh suggestions.",
        );
      if (apply) {
        const response = await fetch(`/api/voice/stylist/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ optionId: option.id, draft }),
          }),
          data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error?.message ?? "The option could not be applied.",
          );
        if (original !== canonicalJson(current.current))
          throw new Error("Your scene changed. The option was not applied.");
        onPreview(null);
        setPreview("");
        onApply({ ...option, draft: data.draft });
      } else {
        onPreview(option.draft);
        setPreview(option.id);
      }
    } catch (e) {
      onPreview(null);
      setPreview("");
      setError(e instanceof Error ? e.message : "The option could not load.");
    } finally {
      setWorking("");
    }
  }
  const selectedProduct =
    selected && draft.items[selected]
      ? findDemoProduct(itemProductId(selected, draft.items[selected]))
      : null;
  return (
    <section className="stylist-panel" aria-label="AI shopping stylist">
      <div className="stylist-heading">
        <span>
          <Sparkles size={17} /> Shopping stylist
        </span>
        <small>Powered by Meta</small>
      </div>
      <details
        className="stylist-request"
        open={!result || !result.options.length}
      >
        <summary>
          Your request · {money(subtotalInput)} budget <span>Edit</span>
        </summary>
        <label
          className="stylist-prompt-label"
          htmlFor={`stylist-prompt-${sceneId}`}
        >
          What would you like to change?
        </label>
        <textarea
          id={`stylist-prompt-${sceneId}`}
          value={text}
          maxLength={1000}
          rows={2}
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value);
            setVoice(undefined);
          }}
        />
        <div className="stylist-input-row">
          <label>
            Budget <span>USD</span>
            <input
              aria-label="Merchandise budget in USD"
              inputMode="decimal"
              value={budget}
              disabled={busy}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <VoiceInput
            purpose="showroom"
            field="shopping request"
            label="Speak"
            disabled={busy || !!working}
            maxLength={1000}
            replaceOnly
            onUse={(value) => {
              setText(value.text);
              setVoice(value.attemptId);
            }}
          />
        </div>
        {selectedProduct && (
          <div className="stylist-keep-controls">
            <label>
              <input
                type="checkbox"
                checked={keep.includes(selected)}
                disabled={busy}
                onChange={(e) =>
                  setKeep((k) =>
                    e.target.checked
                      ? [...k, selected]
                      : k.filter((id) => id !== selected),
                  )
                }
              />
              Keep {selectedProduct.name}
            </label>
            <label>
              <input
                type="checkbox"
                checked={!!draft.items[selected].owned}
                disabled={busy}
                onChange={(e) => onOwned(selected, e.target.checked)}
              />
              Already own this
            </label>
          </div>
        )}
        {!!keep.length && (
          <div className="stylist-kept">
            {keep.map(
              (slot) =>
                draft.items[slot] && (
                  <button
                    key={slot}
                    disabled={busy}
                    title="Remove keep constraint"
                    onClick={() =>
                      setKeep((k) => k.filter((id) => id !== slot))
                    }
                  >
                    <Check size={11} />
                    {
                      findDemoProduct(itemProductId(slot, draft.items[slot]))
                        ?.name
                    }
                    <X size={11} />
                  </button>
                ),
            )}
          </div>
        )}
        <p className="stylist-caption">
          Kept purchases count toward the budget. Owned pieces stay in the room
          and are excluded. Tax and shipping excluded.
        </p>
        <button
          className="d-button primary full"
          disabled={
            busy || !!working || subtotalInput < 1 || text.trim().length < 3
          }
          onClick={() => void suggest()}
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Sparkles size={15} />
          )}{" "}
          {busy
            ? ({
                QUEUED: "Starting…",
                INTERPRETING: "Understanding your request…",
                CHECKING: "Checking prices & placement…",
                COORDINATING: "Coordinating two looks…",
              }[phase] ?? "Preparing your looks…")
            : "Suggest two looks"}
        </button>
      </details>
      {error && (
        <p className="stylist-error" role="alert">
          {error}
        </p>
      )}
      {recover && (
        <button className="d-text" onClick={() => void suggest(true)}>
          Check saved request
        </button>
      )}
      {result && (
        <>
          <p className="stylist-summary">{result.summary}</p>
          {result.notice && (
            <p className="stylist-notice" role="status">
              {result.notice}
            </p>
          )}
          {stale && !applied && (
            <p className="stylist-notice">
              The scene or request changed. Suggest fresh looks before applying.
            </p>
          )}
          <div className="stylist-options">
            {result.options.map((option) => (
              <article
                key={option.id}
                className={`stylist-option${previewActive && preview === option.id ? " previewing" : ""}${applied?.id === option.id ? " applied" : ""}`}
              >
                <div className="stylist-option-top">
                  <strong>{option.title}</strong>
                  <b>{money(option.subtotalCents)}</b>
                </div>
                <div className="stylist-thumbnails">
                  {Object.entries(option.draft.items).map(([slot, item]) => {
                    const p = findDemoProduct(itemProductId(slot, item))!;
                    return (
                      <div
                        key={slot}
                        title={`${p.name} · ${p.colors[item.color].name}${item.owned ? " · Owned" : ""}`}
                      >
                        <Image
                          src={productCover(p.id)}
                          alt={p.name}
                          width={42}
                          height={42}
                        />
                        {item.owned && <span>Owned</span>}
                      </div>
                    );
                  })}
                </div>
                <p>{option.reason}</p>
                <small>
                  {money(option.remainingCents)} under budget ·{" "}
                  {purchaseLines(option.draft).length} products to buy
                </small>
                <details>
                  <summary>See products & changes</summary>
                  <ul>
                    {Object.entries(option.draft.items).map(([slot, item]) => {
                      const p = findDemoProduct(itemProductId(slot, item))!;
                      return (
                        <li key={slot}>
                          {p.name} · {p.colors[item.color].name}
                          <b>
                            {item.owned
                              ? "Owned"
                              : item.included === false
                                ? "Not included"
                                : money(p.price)}
                          </b>
                        </li>
                      );
                    })}
                  </ul>
                  <ul>
                    {option.changes.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </details>
                <div className="stylist-option-actions">
                  <button
                    className="d-button small"
                    disabled={stale || !!working || busy}
                    onClick={() => {
                      if (previewActive && preview === option.id) {
                        onPreview(null);
                        setPreview("");
                      } else void prepare(option, false);
                    }}
                  >
                    {previewActive && preview === option.id
                      ? "Exit preview"
                      : "Preview"}
                  </button>
                  <button
                    className="d-button primary small"
                    disabled={stale || !!working || busy}
                    onClick={() => void prepare(option, true)}
                  >
                    {working === option.id ? (
                      <LoaderCircle size={13} className="spin" />
                    ) : applied?.id === option.id ? (
                      <Check size={13} />
                    ) : null}
                    {applied?.id === option.id ? "Applied" : "Apply look"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!!result.options.length && (
            <p className="stylist-caption">
              <Check size={12} /> Prices and placement checked · Apply is one
              undoable edit. Add the chosen look using the bag action.
            </p>
          )}
        </>
      )}
    </section>
  );
}
