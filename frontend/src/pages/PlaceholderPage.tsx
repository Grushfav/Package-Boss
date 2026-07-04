interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-black uppercase">{title}</h1>
      <p className="mt-4 text-muted">{description}</p>
      <p className="mt-2 text-sm text-boss-gold">Coming soon</p>
    </div>
  )
}
