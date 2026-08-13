'use client';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/lib/apollo';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
      </body>
    </html>
  );
}
