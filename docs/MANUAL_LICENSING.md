# Maps Hunter Pro — Manual-only licensing (2026-09-11)

## Current commercial flow

Maps Hunter Pro no longer has a customer account system. Customers do not register, log in, reset passwords, submit payments on the website, or manage subscriptions through a portal.

1. Customer chooses Monthly ($20) or Annual ($100) on the public site.
2. Customer pays manually using USDT or RedotPay.
3. Customer sends the payment screenshot plus transaction reference/address to the owner through WhatsApp.
4. Owner verifies the payment manually.
5. Owner opens the Admin dashboard and generates an activation code.
6. Customer enters that code into the extension.
7. A new code starts its subscription term on first successful activation.
8. The extension displays only activation status and expiry date. No customer login exists inside the extension.

## Manual license model

Customer codes are stored in `manual_licenses` as SHA-256 hashes. The full customer code is returned only once when the admin generates it. The admin can later search an exact full code by hashing the search input server-side, or search by the stored code hint/note.

Statuses: `unused`, `active`, `expired`, `revoked`.

Monthly codes: 30 days from first activation and the configured daily result limit (default 1,500).

Annual codes: 365 days from first activation and no commercial daily platform limit.

Admin can extend an existing code after a manual renewal, revoke it, or reset its device bindings.

## Owner access

Owner access is separate from customer codes. The Owner Code is hashed server-side, has no customer account, no expiry, and no daily platform limit. Rotating the Owner Code immediately replaces the previous code.

## Legacy database data

Legacy customer/account/payment/referral tables are intentionally retained in D1 for safe rollback/history but are no longer exposed by the production API. Do not delete them until a separate data-retention decision is made.

## Public API surface

- `GET /api/health`
- `GET /api/plans`
- `GET /api/payment-methods`
- `POST /api/license/validate`
- `POST /api/usage/consume`
- Admin-only `/api/admin/*`

Customer auth/account/payment/referral endpoints are removed from the active router.
