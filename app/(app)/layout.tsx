import AppShell from "./AppShell";

// Thin layout — all the chrome + auth check lives in <AppShell> so app/page.tsx
// (which is outside this route group) can wrap its body in the same shell.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
