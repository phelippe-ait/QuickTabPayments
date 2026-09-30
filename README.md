QuickTab Payments
QuickTab is a scan-to-order QR food pickup platform designed for cafés and takeaway restaurants.
Customers scan a physical QR code and open the restaurant's menu directly in their browser. They can browse the menu, place an order, and pay without downloading a mobile application.
QuickTab is designed as a tool for individual restaurants rather than a marketplace. Each restaurant can have its own website and table-level QR codes.
Project Goals

- Provide a simple QR-based ordering experience.
- Allow customers to browse a restaurant menu from their phone.
- Support online ordering and secure payment processing.
- Give individual restaurants their own ordering experience.
- Reduce the friction of app downloads for customers.
  Technology Stack
  Layer Technology
  Frontend React + TypeScript
  Build Tool Vite
  CSS Framework Tailwind CSS
  Backend & Database Supabase (PostgreSQL)
  Authentication Supabase Auth
  Real-Time Communication Supabase Realtime
  Payment Processing Stripe
  QR Code Generation node-qrcode
  Component Library shadcn/ui
  Hosting & Deployment Vercel
  Unit Testing Vitest
  End-to-End Testing Playwright

Getting Started
Prerequisites
Make sure Node.js and npm are installed.
Check your versions with:
node -v
npm -v
Installation
Clone the repository:
git clone https://github.com/phelippe-ait/QuickTabPayments.git
cd QuickTabPayments
Install dependencies:
npm install
Run the development server
Start the Vite development server:
npm run dev
Vite will display the local development URL in the terminal, normally:
http://localhost:5173/
Vite includes its own development server and Hot Module Replacement (HMR), so the project does not require the VS Code Live Server extension.
Available Scripts
npm run dev # Start the development server
npm run build # Build the application for production
npm run preview # Preview the production build locally
npm run lint # Run ESLint
Environment Variables
Environment variables should be stored in local .env files and should not be committed to Git.
Example:

# Add project-specific environment variables here

Use public frontend variables only where appropriate, and never commit private API keys, payment secrets, service-role keys, or other sensitive credentials.
Project Structure
A typical project structure is:
QuickTabPayments/
├── public/
├── src/
│ ├── assets/
│ ├── components/
│ ├── pages/
│ ├── App.tsx
│ ├── main.tsx
│ └── index.css
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
The exact folder structure may grow as additional features are implemented.
Development Workflow

1. Create or update a feature in src/.
2. Run the development server with npm run dev.
3. Check the application in the browser.
4. Run linting and tests before committing changes.
5. Create a Git commit with a descriptive message.
   Testing
   The project architecture includes:

- Vitest for unit and integration testing.
- Playwright for end-to-end testing.
  Example commands once the testing configuration is installed:
  npm run test
  npx playwright test
  Deployment
  The project is intended to be deployed using Vercel.
  A production build can be created locally with:
  npm run build
  The generated production files are placed in the dist/ directory.
  Project Documentation
  The project proposal and research cover the technology choices, system design, testing strategy, deployment approach, security considerations, and business model for QuickTab.
  Repository
  GitHub: https://github.com/phelippe-ait/QuickTabPayments
  License
  This project is currently being developed as part of an academic project at AIT (Academy of Interactive Technology).
