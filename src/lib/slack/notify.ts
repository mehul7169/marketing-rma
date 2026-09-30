/** Posts to a specific incoming webhook; throws on failure (for callers that must know). */
export async function postSlackWebhook(url: string, text: string, blocks?: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(blocks ? { text, blocks } : { text })
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }
}

export async function sendSlackMessage(text: string, blocks?: unknown[]) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.error("Slack notify skipped: SLACK_WEBHOOK_URL is not set");
    return;
  }

  try {
    await postSlackWebhook(url, text, blocks);
  } catch (err) {
    console.error("Slack notify error", err);
  }
  // never throw — a Slack failure must never break the ingestion flow
}
