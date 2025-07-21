# Replit Configuration for Indique e Ganhe System

## Overview

The "Indique e Ganhe" (Refer and Earn) system is a web application for Grupo Santana that allows people to register as referrers and earn commissions by referring vehicle owners without insurance. The system features a comprehensive referral management platform with different user roles, commission tracking, and payment processing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Web Application
- **Frontend:** React.js with TypeScript, styled using TailwindCSS and Shadcn/UI components
- **Backend:** Node.js with Express.js
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Passport.js with session-based authentication using scrypt for password hashing
- **Build Tools:** Vite for frontend bundling, ESBuild for backend compilation

### Architectural Pattern
The application follows a modern full-stack architecture with:
- Separate client and server directories
- Shared schema definitions between frontend and backend
- API-based communication with RESTful endpoints
- Session-based authentication with PostgreSQL session storage

## Key Components

### User Management System
- **Multi-role support:** referrer (indicador), promoter (promotor), analyst (analista), and admin
- **Registration system:** Comprehensive user registration with personal and banking information
- **Authentication:** Secure login/logout with session management
- **Role-based access control:** Different permissions for each user type

### Referral Management
- **Referral creation:** Users can submit referrals with contact information and vehicle details
- **Status tracking:** Multiple status levels (pending, processing, converted, rejected, validated, paid)
- **Commission calculation:** Automatic commission calculation with R$3.00 per valid referral
- **Duplicate prevention:** System checks for duplicate phone numbers and license plates

### Administrative Features
- **Admin dashboard:** Complete oversight of users, referrals, and payments
- **Status management:** Admins can update referral statuses and process payments
- **Reporting capabilities:** Analytics and reporting for referral performance
- **User management:** Admin can view and manage all registered users

### Commission and Payment System
- **Commission tracking:** Automatic calculation and tracking of user earnings
- **Payment processing:** Withdrawal request system with admin approval
- **Balance management:** User balance tracking and payment history

## Data Flow

### User Registration Flow
1. User submits registration form with personal details
2. System validates data and creates user account with hashed password
3. User receives access to their personalized dashboard

### Referral Process Flow
1. User submits referral information through the new referral form
2. System validates and stores referral data
3. Admin reviews and updates referral status
4. Commission is calculated and added to user balance upon conversion
5. User can request withdrawal of earnings

### Authentication Flow
1. User submits login credentials
2. System validates using scrypt password hashing
3. Session is created and stored in PostgreSQL
4. User is redirected to appropriate dashboard based on role

## External Dependencies

### Frontend Dependencies
- **React ecosystem:** React, React DOM, React Hook Form
- **UI Components:** Radix UI primitives, Shadcn/UI components
- **Styling:** TailwindCSS with custom configuration
- **State Management:** TanStack Query for server state
- **Routing:** Wouter for client-side routing
- **Form Validation:** Zod for schema validation

### Backend Dependencies
- **Web Framework:** Express.js with TypeScript support
- **Database:** PostgreSQL via Neon serverless
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Authentication:** Passport.js with local strategy
- **Session Storage:** connect-pg-simple for PostgreSQL session storage
- **Password Security:** Node.js crypto module with scrypt

### Development Tools
- **Build System:** Vite with React plugin
- **TypeScript:** Full TypeScript support across the stack
- **Database Migrations:** Drizzle Kit for schema management
- **Development Server:** tsx for TypeScript execution

## Deployment Strategy

### Build Process
- Frontend built using Vite to static assets
- Backend compiled using ESBuild to Node.js compatible output
- Database schema managed through Drizzle migrations

### Environment Configuration
- Database connection via DATABASE_URL environment variable
- Session configuration with PostgreSQL backing
- Production-ready session table creation scripts

### File Organization
- `client/`: Frontend React application
- `server/`: Backend Express.js application  
- `shared/`: Common TypeScript schemas and types
- `db/`: Database configuration and seeding scripts
- `documentacao/`: Project documentation and legal files

The system is designed for deployment on platforms that support Node.js applications with PostgreSQL databases, with specific scripts for session table creation and database seeding for initial setup.

## Recent Updates (July 2025)

### Automatic Commission Reversal System (July 2025)
- **Financial Integrity Protection:** Implemented automatic commission reversal when referral status is changed from paid to non-paid states
- **Intelligent Detection:** System detects when status moves from `validated` or `converted` back to `pending`, `rejected`, etc.
- **Automatic Balance Updates:** Automatically removes incorrect commission amounts from both indicator and promoter account balances
- **Audit Trail:** Logs all commission reversals with detailed information in audit log
- **Database Consistency:** Updates referral commission fields to 0.00 when status is reverted
- **Multi-user Support:** Handles commission reversals for both indicadores and promotores correctly
- **Error Prevention:** Prevents financial discrepancies from status changes and ensures accurate user earnings

### Support Ticket System Implementation
- **Comprehensive Support Infrastructure:** Added complete support ticket system with file attachments and admin management interface
- **User Interface:** Floating support button appears on all pages for easy ticket creation
- **Ticket Management:** Automatic numbering system (YYYYMMDD-XXXX format), priority levels, category classification
- **File Attachments:** Support for up to 3 files per ticket (5MB each), handling images, PDFs, and text files
- **Admin Interface:** Complete admin panel for ticket management with filtering, status tracking, and response system
- **Database Integration:** New support_tickets and ticket_responses tables with proper relations
- **Status Workflow:** Open → In Progress → Resolved → Closed status progression
- **User Experience:** "My Tickets" view for users to track their support requests

### Back Button Component Implementation
- **Reusable Component:** Created `BackButton` component with consistent styling and behavior
- **Smart Navigation:** Supports both programmatic navigation (with `to` prop) and browser back functionality
- **User Experience:** Added to key pages (New Referral, Earnings, Referrals) for better navigation flow
- **Visual Design:** Uses arrow icon with outline button style for clear navigation indication
- **Integration:** Placed strategically in page headers alongside main content for easy access

### Privacy Policy and Terms Implementation
- **Legal Compliance:** Added comprehensive privacy policy and terms of consent for the "Indique e Ganhe" program
- **Dialog Component:** Created `PrivacyPolicyDialog` component with full terms content and scrollable interface
- **Footer Integration:** Added clickable privacy policy and terms links in the footer with modal dialogs
- **Registration Compliance:** Updated registration form with mandatory terms acceptance and embedded policy links
- **LGPD Compliance:** Full privacy policy content includes LGPD compliance terms and user rights information
- **User Consent:** Clear "Li e aceito os termos" (I have read and accept the terms) checkbox with linked policy dialogs