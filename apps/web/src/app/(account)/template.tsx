// Layouts persist across navigation; the template re-mounts the page area so
// moving between account sections fades instead of snapping.
export default function AccountTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="page-fade">{children}</div>;
}
