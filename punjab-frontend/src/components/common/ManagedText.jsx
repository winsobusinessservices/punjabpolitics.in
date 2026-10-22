function textBlocks(value) {
  const blocks = [];
  let paragraph = [];
  let bullets = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length) blocks.push({ type: "bullets", items: bullets });
    bullets = [];
  };

  String(value || "").split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    const bullet = line.match(/^(?:-|\*|•)\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
    } else if (!line) {
      flushParagraph();
      flushBullets();
    } else {
      flushBullets();
      paragraph.push(line);
    }
  });
  flushParagraph();
  flushBullets();
  return blocks;
}

export default function ManagedText({ text, className = "", paragraphClassName = "", listClassName = "" }) {
  if (isRichTextHtml(text)) {
    return <div className={`rich-text ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(text) }} />;
  }

  const blocks = textBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, index) => block.type === "bullets" ? (
        <ul key={`list-${index}`} className={`list-disc space-y-2 pl-5 ${listClassName}`}>
          {block.items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}
        </ul>
      ) : (
        <p key={`paragraph-${index}`} className={paragraphClassName}>{block.text}</p>
      ))}
    </div>
  );
}
import { isRichTextHtml, sanitizeRichText } from "@/lib/richText";
