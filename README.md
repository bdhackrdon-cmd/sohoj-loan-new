# সহজ লোন — Production-ready starter

এটি একটি full-stack starter:
- Applicant loan application
- 5,000–20,000 BDT selectable loan amount
- Fee disclosure/calculation (10% demo configuration)
- Application status lookup
- Admin login via secure HTTP-only cookie
- Admin application list/filter
- Applicant data verification checklist
- Approve/reject workflow
- Approval blocked until verification checklist is complete
- SQLite database
- Audit log
- Helmet security headers + rate limiting

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set a strong `JWT_SECRET`.
4. Set a unique `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
5. Run:
   npm install
   npm start
6. Open http://localhost:3000

## Production checklist

- Put the app behind HTTPS/reverse proxy.
- Set `COOKIE_SECURE=true`.
- Use a strong randomly generated JWT secret.
- Replace the starter admin password with a secret manager / proper identity provider.
- Use PostgreSQL/MySQL for larger deployments and encrypted backups.
- Add MFA, staff roles, IP/device controls and session revocation.
- Encrypt highly sensitive data at rest; minimize what is stored.
- Never log full NID or other sensitive credentials.
- Add formal privacy notice, consent, retention/deletion process and data-subject access controls.
- Add real identity/phone verification only through your authorized provider APIs.
- Add payment gateway only after the fee/repayment model is legally approved and clearly disclosed.
- Add loan agreement, APR/interest/fees, repayment schedule, late-payment terms, complaint process and disbursement records.
- Have Bangladesh-specific regulatory/legal/compliance requirements reviewed by qualified counsel before public launch.
- Back up database and test restore.

## Payment number configured
The UI currently displays the bKash number `01973789345` for the advance-fee instruction and stores an optional payment Transaction ID with each application.

Before collecting real payments, verify that the number/account is owned and authorized by the lending business and that the fee model and disclosure are legally compliant. Do not ask applicants to send money to a personal account unless that is explicitly authorized and compliant.


### Render deployment fix
This version fixes Express 5 wildcard routing and pins Node.js to 20.x for deployment stability.
