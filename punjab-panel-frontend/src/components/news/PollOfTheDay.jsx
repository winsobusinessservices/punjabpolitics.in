"use client";

import { useEffect, useMemo, useState } from "react";
import { pollApi } from "@/lib/api";

function normalizedPoll(poll) {
  const options = (poll?.options || []).map((option) => ({ ...option, votes: Number(option.votes) || 0 }));
  const totalVotes = options.reduce((total, option) => total + option.votes, 0);
  return {
    ...poll,
    totalVotes,
    options: options.map((option) => ({ ...option, pct: totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0 })),
  };
}

export default function PollOfTheDay({ initialPoll }) {
  const [poll, setPoll] = useState(() => normalizedPoll(initialPoll));
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const storageKey = useMemo(() => `indian-rajniti-poll:${initialPoll?.question || "current"}`, [initialPoll?.question]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVoted(localStorage.getItem(storageKey) === "voted"));
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  const vote = async (optionIndex) => {
    if (voted || submitting) return;
    setSubmitting(true);
    try {
      const result = await pollApi.vote(optionIndex);
      setPoll(normalizedPoll(result.poll));
      localStorage.setItem(storageKey, "voted");
      setVoted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="pt-4 border-t border-outline-variant/30">
    <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
      <h3 className="font-headline-md text-primary tracking-tight text-lg">Poll of the Day</h3>
      <i className="fa-solid fa-square-poll-vertical text-secondary text-lg" />
    </div>
    <p className="font-body-md text-sm text-on-surface mb-3">{poll.question}</p>
    <div className="space-y-2">
      {poll.options.map((option, index) => voted ? <div key={`${option.label}-${index}`}>
        <div className="flex items-center justify-between text-xs mb-1"><span className="font-label-md text-on-surface-variant">{option.label}</span><span className="font-label-md text-primary font-bold">{option.pct}%</span></div>
        <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${option.pct}%` }} /></div>
      </div> : <button key={`${option.label}-${index}`} type="button" disabled={submitting} onClick={() => vote(index)} className="w-full rounded-md border border-primary/30 bg-surface px-3 py-2 text-left text-xs font-label-md text-on-surface transition-colors hover:bg-primary hover:text-on-primary disabled:opacity-50">{option.label}</button>)}
    </div>
    <p className="text-outline text-[10px] mt-3">{poll.totalVotes.toLocaleString()} votes cast{voted ? " • Thank you for voting" : ""}</p>
  </div>;
}
