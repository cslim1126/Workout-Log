import "./globals.css";

export const metadata = {
  title: "Workout Log",
  description: "Personal workout tracker"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
