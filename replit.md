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

### 2025-08-07 - Plate Search Feature for All Users
- Implemented plate search functionality available for all authenticated users
- Created new `/plate-search` page with automatic Brazilian plate formatting
- Added "Consultar Placa" button to all users' dashboards
- API endpoint `/api/search-plate` accessible by any authenticated user
- Backward compatibility maintained with old `/api/indicador/search-plate` endpoint
- Real-time validation shows if plate is already registered with status and date
- Prevents duplicate vehicle registrations in the platform

### 2025-08-07 - Balance and Earnings Logic Correction
- Fixed critical issue where user balances were showing R$0 when users had available funds
- Corrected business logic for balance and totalEarnings:
  - `balance`: Available withdrawal balance (pending commissions from validated/converted referrals)
  - `totalEarnings`: Total amount already paid to user (only withdrawals with status "paid")
- When referrals are reassigned to different users, commissions are now automatically transferred
- Created fix-user-balances.ts script to recalculate all user balances based on current referrals
- totalEarnings now only updates when a withdrawal is marked as "paid", not when referrals are paid

### 2025-08-06 - Analyst Edit Permissions Fix
- Fixed issue where analysts (especially level 1) couldn't edit referral status
- Added `edit_referral_status` permission to all analysts automatically
- Created ensure-analyst-permissions.ts script to manage analyst permissions by level
- Modified storage.createUser to automatically assign correct permissions when creating analysts
- All analysts now have proper permissions to edit referral status

### 2025-08-05 - Promoter Profile Display Enhancement
- Updated admin-indicators.tsx to correctly display analyst level 3 assignments for promoters
- Modified getAnalystAssignment function to check promoter's supervisorId field
- Promoters now show the name of their assigned analyst level 3 in the "Atribuição" column
- Added profile card in promoter dashboard showing assigned analyst information

### 2025-02-03 - Withdrawal System Improvements
- Removed restrictive PIX key validation that required exact match with profile
- Users can now use any valid PIX key for withdrawals
- Removed CPF validation that forced users to use only their registered CPF
- Improved user experience allowing flexibility in withdrawal requests
- Fixed balance deduction logic to prevent negative balances:
  - Balance is deducted only once when withdrawal is created
  - Rejected withdrawals now properly return the amount to user's balance
  - Approved/Paid status changes no longer affect user balance

### 2025-02-03 - Simplified Company Selection for Non-Admin Users
- Modified new referral page to show only "Kong Pix" for non-admin users
- Admin users retain full company selection capabilities
- Automatically assigns Kong Pix (ID 1) for all non-admin referrals
- Fixed validation error ensuring companyId is always a positive number

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