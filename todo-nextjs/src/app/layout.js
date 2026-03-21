export const metadata = {
  title: 'Todo App - db9 + Next.js',
  description: 'A simple todo app powered by db9 and Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  );
}
