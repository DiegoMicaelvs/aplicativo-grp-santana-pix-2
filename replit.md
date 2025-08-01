# Replit Configuration for Indique e Ganhe System

## Overview
The "Indique e Ganhe" (Refer and Earn) system is a web application for Kong Pix that allows individuals to register as referrers and earn commissions by referring vehicle owners without insurance. It features a comprehensive referral management platform with multi-role support, commission tracking, payment processing, and robust security measures. The business vision is to provide a seamless and secure platform for managing insurance referrals, fostering a network of referrers, and expanding market reach through incentivized referrals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Web Application
- **Frontend:** React.js with TypeScript, styled using TailwindCSS and Shadcn/UI components.
- **Backend:** Node.js with Express.js.
- **Database:** PostgreSQL with Drizzle ORM.
- **Authentication:** Passport.js with session-based authentication using scrypt for password hashing.
- **Build Tools:** Vite for frontend bundling, ESBuild for backend compilation.

### Architectural Pattern
The application follows a modern full-stack architecture with separate client and server directories, shared schema definitions, API-based communication via RESTful endpoints, and session-based authentication with PostgreSQL session storage.

### Key Features
- **User Management:** Supports referrer, promoter, analyst, manager, and admin roles with role-based access control, comprehensive registration, and secure authentication.
- **Referral Management:** Allows creation and tracking of referrals with multiple status levels (pending, processing, converted, rejected, validated, paid), automatic commission calculation, and duplicate prevention for phone numbers and license plates.
- **Commission and Payment System:** Tracks commissions with intelligent accumulation based on referral status changes and supports withdrawal requests with admin approval.
- **Administrative Features:** Provides an admin dashboard for user, referral, and payment oversight, status management, and reporting.
- **Support Ticket System:** Integrated system for users to create support tickets with file attachments, managed through an admin interface.
- **Legal Compliance:** Implementation of Privacy Policy and Terms of Consent with LGPD compliance.
- **Lead Security System:** 4-layer security system preventing fraud with daily limits, duplicate detection across the database and multiple app instances (cross-app validation), and minimum withdrawal protection.
- **User Creation System:** Comprehensive forms for creating users of all roles with proper password hashing and validation.
- **Indicador Assignment System:** Admin interface for assigning and unassigning indicators to promoters.
- **Analyst Capabilities:** Analysts can view and validate referrals, create new indicators and promoters, and view their assigned permissions.
- **Rebranding:** Complete rebranding to Kong Pix, including new color palette, logo, social media links, and updated legal documents.

### UI/UX Decisions
- **Color Scheme:** Kong Pix yellow (#fcb900) and secondary gray (#abb8c3) are used throughout the application.
- **Components:** Utilizes Radix UI primitives and Shadcn/UI components for a consistent and modern interface.
- **Navigation:** BackButton component for consistent navigation, and role-specific dashboard links in the header.
- **Responsive Design:** Enhanced mobile responsiveness with:
  - Statistics cards that adapt from 1 column on mobile to 5 columns on desktop
  - Buttons that stack vertically on mobile and display horizontally on larger screens
  - Text sizes that scale appropriately for different screen sizes
  - Dialog widths that adjust to 95% viewport width on mobile devices

## External Dependencies

### Frontend Dependencies
- **React ecosystem:** React, React DOM, React Hook Form.
- **UI Components:** Radix UI primitives, Shadcn/UI.
- **Styling:** TailwindCSS.
- **State Management:** TanStack Query.
- **Routing:** Wouter.
- **Form Validation:** Zod.

### Backend Dependencies
- **Web Framework:** Express.js.
- **Database:** PostgreSQL (via Neon serverless).
- **ORM:** Drizzle ORM.
- **Authentication:** Passport.js.
- **Session Storage:** connect-pg-simple.
- **Password Security:** Node.js crypto module (scrypt).
- **SMS Service:** Comtele SMS API (for sending welcome SMS and notifications).

### Development Tools
- **Build System:** Vite.
- **Type Checking:** TypeScript.
- **Database Migrations:** Drizzle Kit.
- **Development Server:** tsx.