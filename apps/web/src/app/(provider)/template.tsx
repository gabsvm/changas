export default function ProviderTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="page-fade">{children}</div>;
}
