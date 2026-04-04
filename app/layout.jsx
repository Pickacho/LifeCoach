import './globals.css';

export const metadata = {
  title: 'AI Life Coach',
  description: 'Proactive ADHD-friendly AI Life Coach',
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
      </body>
    </html>
  );
}
