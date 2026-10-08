# BookEase Master Architecture

## System overview

BookEase is planned as a web application with a React frontend, a Laravel backend, and a MySQL database.

```text
React + Vite frontend
          |
          | HTTP API
          v
     Laravel backend
          |
          v
       MySQL database
```

## Delivery roadmap

### Phase 1: Project setup

- Create the React application using Vite.
- Create the Laravel application and establish the frontend-to-backend API boundary.
- Configure MySQL for local development and application use.
- Add environment-based configuration and document how to run each application.

**Milestone:** The frontend and backend run locally and the backend can connect to MySQL.

### Phase 2: Authentication

- Implement account registration, sign-in, and sign-out.
- Add authenticated API access and protect routes that require a signed-in user.
- Define the initial user roles and authorization boundaries needed by later phases.

**Milestone:** Users can securely authenticate and access role-appropriate application areas.

### Phase 3: Users, vendors, and services

- Define user and vendor profiles.
- Support vendor onboarding and profile management.
- Let vendors create and manage the services they offer.
- Provide service discovery for customers.
- Initial implementation: vendor business profiles and service CRUD are available
  through the vendor workspace; active services are searchable in the public
  service directory at `/services`.

**Milestone:** Vendors can publish services and customers can find them.

### Phase 4: Booking

- Let customers select a service and request or make a booking.
- Track booking details, availability, and booking status.
- Provide booking management views for customers and vendors.
- Initial implementation: customers can request future slots from the service
  directory; vendors configure recurring weekly opening hours and a timezone,
  and requests must fit within those hours. Overlapping pending/confirmed
  requests are rejected, customers can cancel, and vendors can confirm,
  decline, or complete bookings.

**Milestone:** Customers and vendors can manage the booking lifecycle.

### Phase 5: Admin

- Provide administrative access to manage users, vendors, services, and bookings.
- Add operational views and moderation controls appropriate to the platform.
- Enforce administrator-only access to these capabilities.
- Initial implementation: paginated admin views cover users, vendor profiles,
  services, and bookings, with an overview of platform totals and pending
  bookings; admins can disable accounts, hide listings, and cancel or reject
  active bookings. Disabled users cannot sign in or use authenticated API
  routes.
- Promote accounts to the admin role only through a trusted provisioning
  process (for local development, use Laravel Tinker; never expose public
  administrator registration).

For local development, promote a known account with
`cd backend && php artisan tinker --execute="App\\Models\\User::where('email', 'admin@example.com')->update(['role' => App\\Enums\\UserRole::ADMIN])"`
(replace the example email with that account's email).

**Milestone:** Administrators can oversee core platform activity.

### Phase 6: Payments

- Integrate a payment provider for booking-related transactions.
- Track payment state and associate payments with bookings.
- Handle payment success, failure, and relevant status updates.
- Initial implementation: Paystack checkout in NGN is required when requesting
  a booking; signed webhooks and server-side transaction verification track
  payment outcomes, and paid bookings are automatically refunded when cancelled
  or rejected.

**Milestone:** Payments can be initiated and their outcomes are reflected in booking records.

## Implementation order

Complete the phases in order. Payments follow booking so transactions can be tied to an established booking lifecycle. Each phase should be validated before building on it.
