# Contacts API — migrating from v1 to v2

*Published alongside `contacts-v2.json`. Written the way a real provider writes a
changelog, because that is what the repair agent has to read.*

This release contains breaking changes. Read the whole note before upgrading.

## `customer_name` is now `full_name`

The field has been renamed. The value is unchanged: the same string, in the same
format. Replace every read of `customer_name` with `full_name`.

## `lifetime_value` is now a decimal string

It was a JSON number and is now a string with exactly two decimal places, for
example `"8420.50"`. Binary floating point was losing fractions of a cent on
large balances, so the value now travels as text.

Parse it before doing arithmetic. Code that formats it for display usually needs
one conversion at the boundary rather than changes throughout.

## `GET /v1/contacts` requires `workspace_id`

The list endpoint now requires a `workspace_id` query parameter. Requests
without it are rejected with `400` and `{"error":"workspace_id_required"}`.
Pass the workspace the contacts belong to.

## `GET /v1/contacts/{id}/activity` has been replaced by `/events`

The activity feed is now the event feed, at
`GET /v1/contacts/{id}/events`. Within each entry, `kind` is now `type`. The
values are unchanged: `login`, `purchase`, `support_ticket`.

## `GET /v1/contacts/{id}/notes` has been withdrawn

The notes endpoint has been removed. There is no replacement in v2. Contact
support if your integration depends on it.

---

*Nothing in this note describes a change to the `email` field.*
