const INLINE_PATTERN = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_)/gi;

export default function LinkedText({ children }) {
  const text = String(children || "");
  const parts = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    if (match[2] && match[3]) {
      parts.push(
        <a
          key={`${match.index}-${match[3]}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="box-decoration-clone rounded-sm bg-secondary-fixed px-1 font-bold text-primary underline decoration-secondary underline-offset-2 break-words transition-colors hover:bg-secondary-fixed-dim hover:text-primary-container"
        >
          {match[2]}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>,
      );
    } else if (match[4] || match[5]) {
      parts.push(<strong key={`${match.index}-bold`} className="font-bold text-on-surface">{match[4] || match[5]}</strong>);
    } else {
      parts.push(<em key={`${match.index}-italic`} className="italic">{match[6] || match[7]}</em>);
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length ? parts : text;
}
