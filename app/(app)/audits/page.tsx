import { redirect } from "next/navigation";

// `/audits` history was renamed to `/history`. Keep the old route as a redirect
// so existing bookmarks don't 404.
export default function AuditsRedirect() {
  redirect("/history");
}
