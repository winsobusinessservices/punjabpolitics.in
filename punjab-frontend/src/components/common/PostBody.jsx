import LinkedText from "@/components/common/LinkedText";
import { isRichTextHtml, sanitizeRichText } from "@/lib/richText";

function contentBlocks(content) {
  if (Array.isArray(content)) return content;
  return String(content || "").split(/\n\s*\n/);
}

function headingOf(text) {
  const markdownHeading = text.match(/^(#{1,6})\s+([^\r\n]+)$/);
  if (markdownHeading) {
    return { depth: markdownHeading[1].length, text: markdownHeading[2].trim() };
  }

  // Authors historically entered section titles as short blocks on their own
  // line. Keep those articles working as headings without requiring an edit.
  const isStandaloneHeading = !text.includes("\n") && text.length <= 100 && !/[.!?]$/.test(text);
  return isStandaloneHeading ? { depth: 2, text } : null;
}

const HEADING_CLASSES = {
  1: "font-display-lg text-2xl md:text-3xl",
  2: "font-headline-lg text-xl md:text-2xl",
  3: "font-headline-md text-lg md:text-xl",
};

export default function PostBody({ content, className = "space-y-6" }) {
  if (isRichTextHtml(content)) {
    return <div className={`rich-text ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }} />;
  }

  const blocks = contentBlocks(content).map((block) => String(block).trim()).filter(Boolean);
  const firstParagraphIndex = blocks.findIndex((block) => !headingOf(block));

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        const heading = headingOf(block);
        if (heading) {
          const HeadingTag = heading.depth <= 2 ? "h2" : heading.depth === 3 ? "h3" : "h4";
          const sizeClass = HEADING_CLASSES[Math.min(heading.depth, 3)] || HEADING_CLASSES[3];
          return (
            <HeadingTag
              key={`${heading.text}-${index}`}
              className={`${sizeClass} border-l-4 border-primary pl-3 font-bold leading-snug text-primary`}
            >
              <LinkedText>{heading.text}</LinkedText>
            </HeadingTag>
          );
        }

        const isFirstParagraph = index === firstParagraphIndex;
        return (
          <p
            key={`${block.slice(0, 40)}-${index}`}
            className={`${isFirstParagraph ? "font-body-lg text-on-surface" : "font-body-md text-on-surface-variant"} whitespace-pre-line break-words leading-relaxed`}
          >
            <LinkedText>{block}</LinkedText>
          </p>
        );
      })}
    </div>
  );
}
