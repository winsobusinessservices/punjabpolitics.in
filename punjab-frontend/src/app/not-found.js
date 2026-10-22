import { redirect } from "next/navigation";

// Any missing page (or one hidden with notFound(), e.g. a disabled feature)
// sends visitors to the home page instead of showing a dead end.
export default function NotFound() {
  redirect("/");
}
