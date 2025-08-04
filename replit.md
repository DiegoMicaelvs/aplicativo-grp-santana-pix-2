# Replit Project Information

## Project Overview
A comprehensive digital referral platform for Grupo Santana, transforming vehicle insurance networking through intelligent technological solutions.

### Key Features
- Multi-role authentication system (indicador, promotor, analista, gerente, admin, vendedor)
- Advanced location-based SMS notification system
- Real-time referral status tracking and management  
- Detailed audit trails for comprehensive referral oversight
- Enhanced geographic referral tracking with city and state display
- Supervisor-based filtering for Analyst Level 3 users

### Technologies
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session-based auth
- **SMS Service**: Twilio integration

## Project Architecture

### Database Schema
- **Users Table**: Multi-role users with hierarchical relationships
  - `supervisorId`: Links users to their Analyst Level 3 supervisor
  - `promoterId`: Links indicadores to their promoter
  - `analystLevel`: Defines analyst seniority (1-3)
  - Permissions system for granular access control

- **Referrals Table**: Complete referral lifecycle management
  - Status tracking with history
  - Commission management
  - Geographic location tracking (city/state)
  - Validation fields for data quality

- **Supporting Tables**: Companies, Withdrawals, Audit Log, Cash Flow, Support Tickets

### API Architecture
- RESTful API with role-based middleware
- Separate endpoints for each role (admin, analyst, promoter, etc.)
- Automatic filtering for Analyst Level 3 users:
  - `/api/analyst/users` - Returns only supervised users
  - `/api/analyst/referrals` - Returns only referrals from supervised users
  - `/api/analyst/stats` - Shows statistics only for supervised users

### Frontend Structure
- Role-based routing and dashboards
- Responsive design with mobile optimization
- Real-time updates using React Query
- Visual indicators for filtered data (Analyst Level 3)

## Recent Changes

### 2025-01-03 - Analyst Level 3 Filtering Implementation
- Added supervisor-based filtering for Analyst Level 3 users
- When Analyst Level 3 users access the system, they now see:
  - Only users assigned to them (via supervisorId field)
  - Only referrals created by their supervised users
  - Statistics filtered to their supervised team
- Added visual indicators in the UI to show when data is filtered
- Assigned initial users to existing Analyst Level 3 for testing

### Implementation Details
- Backend filtering implemented in routes:
  - `storage.getAllUsersBySupervisor()` - Gets all users under supervision
  - `storage.getReferralsBySupervisor()` - Gets referrals from supervised users
- Frontend shows badges indicating filtered view for Level 3 analysts
- Automatic assignment of supervisorId when Level 3 analysts create new users

## User Preferences
- Language: Portuguese (pt-BR) for all user-facing content
- Code comments and technical documentation in English
- Maintain existing design patterns and color schemes
- Preserve all existing functionality while adding new features

## Development Guidelines
- Always test with different user roles
- Maintain backward compatibility
- Update documentation when adding new features
- Follow existing code patterns and conventions
- Use TypeScript for type safety
- Implement proper error handling and user feedback