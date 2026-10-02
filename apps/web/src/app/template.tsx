// Re-mounts on navigation, so the fade replays for every route change.
export default function RootTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="page-fade">{children}</div>;
}
