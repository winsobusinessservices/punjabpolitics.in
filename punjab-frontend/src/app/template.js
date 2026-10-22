// template.js (unlike layout.js) remounts on every navigation, so the CSS
// animation below replays each time a link is clicked — giving route changes
// a smooth fade/slide-in instead of an abrupt swap.
export default function Template({ children }) {
  return <div className="page-transition">{children}</div>;
}
