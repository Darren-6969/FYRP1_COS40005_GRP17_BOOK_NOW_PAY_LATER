function isSafePath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

// Where "Back" goes. A visitor sent here from a public page returns to it; one
// sent from a signed-in page (which would only bounce back here) goes home.
export function backLinkFor(redirect) {
  if (!isSafePath(redirect)) return { to: "/", label: "Back to the site" };
  const path = redirect.split(/[?#]/)[0];
  if (/^\/cars\/\d+\/book\/?$/.test(path)) return { to: redirect, label: "Back to your booking" };
  if (/^\/cars\/\d+\/?$/.test(path)) return { to: redirect, label: "Back to the car" };
  if (path === "/cars") return { to: redirect, label: "Back to the results" };
  if (/^\/(o|operators)\/[^/]+\/?$/.test(path)) return { to: redirect, label: "Back to the seller page" };
  return { to: "/", label: "Back to the site" };
}
