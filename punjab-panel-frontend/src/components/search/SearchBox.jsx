"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useIsClient } from "@/hooks/useIsClient";
import { CATEGORY_TYPE_LABEL } from "@/lib/constants";

/**
 * Debounced live-suggestions search box backed by GET /api/search (a thin
 * JSON wrapper around the same searchContent() the /search results page
 * uses). Renders a dropdown of category (politician/party/state/topic) and
 * post matches as you type; Enter or "See all results" goes to the full
 * /search page. Shared between the desktop header and the mobile menu.
 *
 * The dropdown is rendered via a portal into document.body, positioned with
 * `fixed` at the input's own bounding rect. Header wraps everything in
 * `backdrop-blur-md`, which creates a new stacking context — any z-index
 * inside it only wins against siblings *within* that context, so without
 * the portal the dropdown quietly renders behind later DOM siblings like
 * the hero section regardless of z-index (same root cause MobileMenu/
 * ProfileMenu already route around this way).
 */
export default function SearchBox({
  autoFocus = false,
  onNavigate,
  placeholder = "Search politicians, parties, states, news...",
  inputClassName = "",
  wrapperClassName = "",
}) {
  const router = useRouter();
  const isClient = useIsClient();
  const containerRef = useRef(null);
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const measure = () => setRect(containerRef.current?.getBoundingClientRect() ?? null);

  // Reads the ref inside an event handler, never during render — measuring
  // there and stashing the result in state is what React's rules want
  // instead of `containerRef.current.getBoundingClientRect()` in the render
  // body (same shape as Header.jsx's openProfileMenu).
  const openDropdown = () => {
    measure();
    setOpen(true);
  };

  useEffect(() => {
    const trimmed = query.trim();
    // No setState here for the empty case — `showDropdown` already gates on
    // a non-empty query, so stale `results` from a moment ago just sits
    // unused until the next real query resolves. Avoids a synchronous
    // setState-in-effect for what the dropdown never shows anyway.
    if (!trimmed) return;

    const controller = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=5`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          // Re-measure right as new content is about to render — if an
          // ancestor (e.g. MobileMenu's slide-in drawer) was still
          // transitioning when the box first opened, this is the moment
          // clickable content actually appears, so it's the position that
          // has to be right, not whatever was captured back on focus.
          measure();
          setResults(data);
          setActiveIndex(-1);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setResults({ categories: [], posts: [] });
        });
    }, 250);

    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!event.target.closest("[data-search-box]")) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The dropdown is `position: fixed` at a rect captured once on open, so
  // without this it stays glued to those original viewport coordinates while
  // the input (in normal document flow) moves as the page — or any scrollable
  // ancestor — scrolls. `capture: true` catches scroll on any ancestor
  // container, not just window.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const closeDropdown = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const goToResults = (value) => {
    closeDropdown();
    router.push(`/search?q=${encodeURIComponent(value)}`);
    onNavigate?.();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    goToResults(trimmed);
  };

  const handleSelect = (href) => {
    closeDropdown();
    setQuery("");
    router.push(href);
    onNavigate?.();
  };

  const hasResults = results && (results.categories.length > 0 || results.posts.length > 0);
  const showDropdown = isClient && open && query.trim().length > 0 && rect;

  // Flattened so arrow-key navigation and mouse hover share one source of
  // truth for "which item is highlighted" instead of tracking category/post
  // index separately.
  const items = [
    ...(results?.categories.map((entry) => ({
      key: `cat-${entry.slug}`,
      href: `/category/${entry.slug}`,
      icon: "fa-user-tie",
      iconClassName: "text-primary",
      label: entry.label,
      sublabel: CATEGORY_TYPE_LABEL[entry.type],
    })) ?? []),
    ...(results?.posts.map((story) => ({
      key: `post-${story.slug || story.id}`,
      href: `/news/${story.slug}`,
      icon: "fa-newspaper",
      iconClassName: "text-secondary",
      label: story.title,
    })) ?? []),
  ];

  const handleKeyDown = (event) => {
    if (!showDropdown) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
      return;
    }

    if (!items.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(items[activeIndex].href);
    }
  };

  // Keeps the dropdown fully within the viewport horizontally — without
  // this, an input near the right edge (e.g. a narrow mobile-menu layout)
  // would render a dropdown that overflows off-screen.
  const VIEWPORT_MARGIN = 8;
  const left = rect
    ? Math.min(Math.max(rect.left, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN))
    : 0;

  return (
    <div ref={containerRef} data-search-box className={`relative ${wrapperClassName}`}>
      <form onSubmit={handleSubmit} className="relative">
        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none" />
        <input
          type="text"
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            openDropdown();
          }}
          onFocus={openDropdown}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          className={`pl-9 ${inputClassName}`}
        />
      </form>

      {showDropdown &&
        createPortal(
          <div
            data-search-box
            id={listboxId}
            role="listbox"
            className="fixed bg-surface border border-outline-variant/30 rounded-lg shadow-xl z-200 max-h-96 overflow-y-auto"
            style={{ top: rect.bottom + 8, left, width: rect.width }}
          >
            {!results && (
              <p className="flex items-center gap-2 px-4 py-3 text-sm font-body-md text-on-surface-variant">
                <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
                Searching...
              </p>
            )}

            {results && !hasResults && (
              <p className="px-4 py-3 text-sm font-body-md text-on-surface-variant">
                No matches for &ldquo;{query}&rdquo;
              </p>
            )}

            {items.map((item, index) => (
              <button
                key={item.key}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                type="button"
                onClick={() => handleSelect(item.href)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors border-b border-outline-variant/10 ${
                  index === activeIndex ? "bg-surface-container-low" : "hover:bg-surface-container-low"
                }`}
              >
                <i className={`fa-solid ${item.icon} ${item.iconClassName} text-xs flex-shrink-0`} aria-hidden="true" />
                <span className="font-body-md text-sm text-on-surface truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="ml-auto text-[10px] font-label-md text-on-surface-variant uppercase tracking-widest flex-shrink-0">
                    {item.sublabel}
                  </span>
                )}
              </button>
            ))}

            {hasResults && (
              <button
                type="button"
                onClick={() => goToResults(query.trim())}
                className="w-full px-4 py-2.5 text-left text-sm font-label-md text-primary hover:bg-surface-container-low transition-colors"
              >
                See all results for &ldquo;{query}&rdquo; <i className="fa-solid fa-arrow-right text-xs ml-1" />
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
