export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html,body{height:100%;margin:0;background:transparent!important;overflow:hidden;}`}</style>
      <div className="h-full bg-transparent">{children}</div>
    </>
  );
}
