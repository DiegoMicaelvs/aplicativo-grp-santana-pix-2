# Replit Project Information

## Overview
This project is a digital referral platform for Grupo Santana, aiming to revolutionize vehicle insurance networking through intelligent technological solutions. Its core purpose is to streamline the referral process, manage user roles and permissions, track referral statuses, and provide advanced analytics. Key capabilities include a multi-role authentication system, location-based SMS notifications, real-time referral tracking, and detailed audit trails. The platform seeks to enhance operational efficiency and drive business growth within the vehicle insurance sector.

## User Preferences
- Language: Portuguese (pt-BR) for all user-facing content
- Code comments and technical documentation in English
- Maintain existing design patterns and color schemes
- Preserve all existing functionality while adding new features

## System Architecture

### UI/UX Decisions
The platform features role-based routing and dashboards, responsive design with mobile optimization, and visual indicators for filtered data (e.g., for Analyst Level 3 users). The design maintains the "Metis da Pix" branding, including logos, color palettes, and contact information.

### Technical Implementations
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui. Utilizes React Query for real-time updates.
- **Backend**: Express.js, TypeScript, providing a RESTful API with role-based middleware.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Passport.js with session-based authentication and multi-role support.
- **SMS Service**: Twilio integration for location-based SMS notifications.

### Feature Specifications
- **Multi-role authentication**: Supports `indicador`, `promotor`, `analista` (levels 1-3), `gerente`, `admin`, and `vendedor` roles with hierarchical relationships and granular access control via `supervisorId` and `promoterId` links.
- **Referral Management**: Complete lifecycle tracking including status, commission management, geographic location (city/state), and data validation fields.
- **Supervisor-based Filtering**: Analyst Level 3 users automatically view only users, referrals, and statistics relevant to their supervised teams.
- **Public Dashboard Security**: Secure token-based links for public company dashboards, replacing predictable IDs with random tokens.
- **Plate Search Functionality**: Available for all authenticated users to check vehicle registration status and prevent duplicates.
- **Withdrawal System**: Allows users to use any valid PIX key for withdrawals, with corrected balance deduction logic to prevent negative balances and ensure proper return of funds for rejected withdrawals.
- **Company Selection**: Simplified for non-admin users, defaulting to "Metis da Pix."

### System Design Choices
- **Database Schema**: Includes `Users`, `Referrals`, `Companies`, `Withdrawals`, `Audit Log`, `Cash Flow`, and `Support Tickets` tables. `Users` table defines `supervisorId`, `promoterId`, and `analystLevel`. `Referrals` table tracks status history, commission, and geographic data.
- **API Architecture**: Role-based endpoints with automatic filtering for Analyst Level 3 users to retrieve supervised users, referrals, and statistics.
- **Authentication System**: Critical fixes ensure password hashing is applied only once during user creation and environment detection for cookie security is accurate.

## External Dependencies
- **Twilio**: For SMS notification services.
- **PostgreSQL**: Relational database management system.
- **Drizzle ORM**: Object-Relational Mapper for database interactions.
- **Passport.js**: Authentication middleware for Node.js.