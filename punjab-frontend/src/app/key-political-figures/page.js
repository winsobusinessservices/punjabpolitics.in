import { permanentRedirect } from "next/navigation";

// Old address of /politicians; kept so existing links and search results still work.
export default function KeyPoliticalFiguresRedirect() {
  permanentRedirect("/politicians");
}
