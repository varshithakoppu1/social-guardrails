"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./page.module.css";

interface VerdictResponse {
  safe: boolean;
  categories: string[];
  raw: string;
}

type Status = "idle" | "checking" | "safe" | "flagged" | "error" | "posted";

const MAX_CAPTION = 2200;

export default function Home() {
  const [caption, setCaption] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [verdict, setVerdict] = useState<VerdictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result);
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  async function runCheck() {
    if (!caption && !imageBase64) return;
    setStatus("checking");
    setError(null);
    setVerdict(null);

    try {
      const appApiKey = process.env.NEXT_PUBLIC_APP_API_KEY;
      const res = await fetch("/api/check-safety", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(appApiKey ? { "x-api-key": appApiKey } : {}),
        },
        body: JSON.stringify({ caption, imageBase64: imageBase64 ?? undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setStatus("error");
        return;
      }

      const result = data as VerdictResponse;
      setVerdict(result);
      setStatus(result.safe ? "safe" : "flagged");
    } catch {
      setError("Network error — could not reach the safety check API");
      setStatus("error");
    }
  }

  function editPost() {
    setStatus("idle");
    setVerdict(null);
    setError(null);
  }

  function startOver() {
    editPost();
    setCaption("");
    setImageBase64(null);
    setPreviewUrl(null);
  }

  const hasContent = !!caption || !!imageBase64;
  const shareDisabled = status === "checking" || (!hasContent && status !== "safe");

  const shareLabel =
    status === "checking" ? (
      <>
        <span className={styles.spinner} /> Checking…
      </>
    ) : status === "safe" ? (
      "Share"
    ) : status === "error" ? (
      "Try again"
    ) : (
      "Check & Post"
    );

  return (
    <main className={styles.page}>
      <p className={styles.wordmark}>Guardrails</p>

      <div className={styles.card}>
        <header className={styles.cardHeader}>
          {status === "flagged" || status === "safe" ? (
            <button className={styles.headerLink} onClick={editPost}>
              Edit
            </button>
          ) : (
            <span />
          )}
          <h1 className={styles.cardTitle}>Create new post</h1>
          <span />
        </header>

        {status === "posted" ? (
          <div className={styles.postedState}>
            <div className={styles.postedIcon}>✓</div>
            <p className={styles.postedTitle}>Your post has been shared</p>
            <button className={styles.secondaryButton} onClick={startOver}>
              Share another photo
            </button>
          </div>
        ) : status === "flagged" ? (
          <div className={styles.violation}>
            <div className={styles.violationIcon}>!</div>
            <p className={styles.violationTitle}>We couldn&apos;t post this</p>
            <p className={styles.violationBody}>
              This photo or caption doesn&apos;t follow our Community Guidelines
              {verdict && verdict.categories.length > 0 ? ", specifically:" : "."}
            </p>
            {verdict && verdict.categories.length > 0 && (
              <div className={styles.categories}>
                {verdict.categories.map((cat) => (
                  <span key={cat} className={styles.categoryTag}>
                    {cat}
                  </span>
                ))}
              </div>
            )}
            <button className={styles.primaryButton} onClick={editPost}>
              Edit post
            </button>
          </div>
        ) : (
          <>
            <div className={styles.composer}>
              <div
                className={`${styles.imageWell} ${dragActive ? styles.imageWellActive : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Upload preview" className={styles.previewImg} />
                ) : (
                  <div className={styles.imageWellEmpty}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
                      <path
                        d="M21 15l-5.5-5.5a1 1 0 00-1.4 0L6 18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p>Drag photos here</p>
                    <span className={styles.selectLink}>Select from device</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />

              <div className={styles.captionArea}>
                <div className={styles.userRow}>
                  <div className={styles.avatar}>G</div>
                  <span className={styles.username}>your_account</span>
                </div>
                <textarea
                  className={styles.captionInput}
                  placeholder="Write a caption..."
                  value={caption}
                  maxLength={MAX_CAPTION}
                  disabled={status === "safe"}
                  onChange={(e) => setCaption(e.target.value)}
                />
                <div className={styles.captionFooter}>
                  <span className={styles.charCount}>
                    {caption.length}/{MAX_CAPTION}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.actionBar}>
              {status === "error" && error && <p className={styles.errorText}>{error}</p>}
              {status === "safe" && (
                <div className={styles.readyBanner}>
                  <span className={styles.readyIcon}>✓</span> Ready to post
                </div>
              )}
              <button
                className={status === "safe" ? styles.shareButtonReady : styles.shareButton}
                onClick={status === "safe" ? () => setStatus("posted") : runCheck}
                disabled={shareDisabled}
              >
                {shareLabel}
              </button>
            </div>
          </>
        )}
      </div>

      <p className={styles.footnote}>
        Every post is screened by NVIDIA Nemotron 3.5 Content Safety before it can be
        shared. No image or caption is stored — each check is stateless. See the{" "}
        <a href="https://github.com" target="_blank" rel="noreferrer">
          README
        </a>{" "}
        for architecture notes.
      </p>
    </main>
  );
}
