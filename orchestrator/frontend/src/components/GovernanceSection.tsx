import React from 'react';

export function GovernanceSection() {
  return (
    <div style={styles.wrapper}>
      <div style={styles.title}>Governance &amp; Guardrails</div>
      <div style={styles.grid}>
        <GuardCard
          icon="🤖"
          title="Model"
          body="claude-sonnet-4-6 — pinned across all agents. No model switches without Build Lead approval."
        />
        <GuardCard
          icon="🔒"
          title="System Prompt Isolation"
          body="Agent system prompts are server-side only. Never exposed to the frontend or end users."
        />
        <GuardCard
          icon="🛡"
          title="Injection Detection"
          body="Backend layer scans all input for prompt injection patterns before passing to the agent."
        />
        <GuardCard
          icon="🚦"
          title="Human-in-the-Loop"
          body="No phase advances without an explicit BA approval. Every decision is logged permanently."
        />
        <GuardCard
          icon="📋"
          title="Audit Trail"
          body="All runs, outputs, approvals, and rejections are stored in SQLite. Permanent, tamper-evident."
        />
        <GuardCard
          icon="⚠"
          title="PII &amp; Security Flags"
          body="Input marked [CLIENT-DATA] or [PII] is flagged as SECURITY_FLAG. Handoff is automatically blocked."
        />
        <GuardCard
          icon="📦"
          title="Output Contract"
          body="Every agent returns structured JSON only. Schema is validated before storage. No freeform text."
        />
        <GuardCard
          icon="🏛"
          title="MAS Compliance"
          body="Pipeline designed for MAS Technology Risk Management Guidelines. Human oversight at every gate."
        />
      </div>
    </div>
  );
}

function GuardCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardIcon}>{icon}</div>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardBody}>{body}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '24px',
    marginTop: 24,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: '1px solid #e0e0e0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#f8f9fa',
    borderRadius: 8,
    padding: '16px',
    border: '1px solid #e0e0e0',
  },
  cardIcon: { fontSize: 22, marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#212121', marginBottom: 6 },
  cardBody: { fontSize: 12, color: '#616161', lineHeight: 1.5 },
};
