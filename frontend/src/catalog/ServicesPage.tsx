import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiErrorMessage } from '../services/apiError'
import { getPublicServices } from '../services/catalog'
import type { ServiceListing } from '../services/catalog'

export function ServicesPage() {
  const [services, setServices] = useState<ServiceListing[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getPublicServices()
      .then((listings) => {
        if (active) setServices(listings)
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const query = search.trim().toLocaleLowerCase()
  const filteredServices = services.filter((service) =>
    [service.name, service.description, service.category, service.vendor_profile?.business_name]
      .some((field) => field?.toLocaleLowerCase().includes(query)),
  )

  return (
    <main className="page">
      <section className="welcome-card catalog-card" aria-labelledby="services-title">
        <Link className="brand-link" to="/">BookEase</Link>
        <p className="eyebrow">BOOKEASE · SERVICE DIRECTORY</p>
        <h1 id="services-title">Find a service.</h1>
        <p className="intro">Explore services offered by local professionals.</p>
        <label className="search-label" htmlFor="service-search">Search services</label>
        <input
          id="service-search"
          className="catalog-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by service, category, or business"
        />
        {loading && <p role="status">Loading services…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {!loading && !error && filteredServices.length === 0 && (
          <p className="empty-state">
            {services.length === 0 ? 'No services are available yet.' : 'No services match your search.'}
          </p>
        )}
        <div className="service-list">
          {filteredServices.map((service) => (
            <article className="service-card" key={service.id}>
              <div className="service-card__heading">
                <div>
                  <p className="service-category">{service.category}</p>
                  <h2>{service.name}</h2>
                </div>
                <p className="service-price">${Number(service.price).toFixed(2)}</p>
              </div>
              <p>{service.description}</p>
              <p className="service-meta">
                {service.vendor_profile?.business_name ?? 'Local provider'}
                {service.vendor_profile?.location ? ` · ${service.vendor_profile.location}` : ''}
                {' · '}{service.duration_minutes} min
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
