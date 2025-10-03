import './globals.css'

export const metadata = {
  title: 'CityCosy Aide Compta',
  description: 'Gestion comptable pour CityCosy Strasbourg',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}