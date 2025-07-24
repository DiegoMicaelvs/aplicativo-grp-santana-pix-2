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

## Known Issues and Solutions

### Login Issues in Production (Replit Deploy) - RESOLVED
- **Problem**: Login works in preview but fails on deployed URL (https://indique.replit.app)
- **Cause**: Cookie/session configuration differences between local and production environments
- **Solution Implemented (July 2025)**: 
  1. Implementada detecção automática de ambiente de produção
  2. Configuração adaptativa de cookies baseada no ambiente
  3. Scripts de diagnóstico e manutenção criados
  4. Ver `docs/solucao-login-producao.md` para detalhes técnicos
- **Para Resolver Problemas**: Limpar cookies do navegador ou usar aba anônima

### Database Separation Between Environments (July 2025) - DOCUMENTED
- **Discovery**: Replit uses completely separate PostgreSQL databases for preview and production environments
- **Impact**: Users created in preview don't exist in production and vice-versa
- **Root Cause**: Security feature - prevents development data from mixing with production data
- **Solutions Implemented**:
  1. Created `scripts/diagnose-database-sync.ts` to identify which environment/database is being used
  2. Created `scripts/export-import-data.ts` for manual data synchronization between environments
  3. Documentation in `docs/solucao-banco-separado.md` with complete explanation and solutions
- **Best Practice**: Always use production environment (https://indique.replit.app) for real user registrations
- **Current Data**:
  - Preview environment: 4 users (3 admins, 1 indicador)
  - Production environment: Separate database with different users
  - Admin credentials: admin@kongpix.com.br / admin123 (must be created in each environment)

## Recent Updates (July 2025)

### Manager Role Implementation (July 22, 2025)
- **New User Role:** Added "gerente" (Manager) role with comprehensive permissions between admin and analyst
- **Manager Permissions System:** Created ManagerPermission type with full system access capabilities
- **Dedicated Dashboard:** Created manager-specific dashboard at `/manager` with overview of entire system
- **Permission Groups:** Defined manager-specific permission groups including:
  - Visualização Completa: view_all_referrals, view_all_users, view_all_reports, view_financial_reports, audit_access
  - Gestão: edit_all_referrals, manage_all_users, manage_analysts, manage_promoters, manage_withdrawals, manage_companies
- **Role Integration:** Updated all user management interfaces to support gerente role
- **Navigation Updates:** Added manager dashboard link in header navigation
- **Protected Routes:** Created ManagerRoute component for role-based access control
- **Visual Identity:** Gerente role uses green color scheme in badges and UI elements

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

### Secure User Deletion System (July 2025)
- **Master Password Protection:** User deletion requires developer master password "Diego91425751" for security
- **Comprehensive Data Cleanup:** Deletes all related user data including referrals, tickets, audit logs, and cash flow entries
- **Admin Deletion Enabled:** Admin users can now be deleted with proper master password authentication
- **Transaction Safety:** Uses database transactions to ensure data consistency during deletion process
- **Audit Trail:** Logs all deletion attempts with complete user information for security tracking
- **UI Integration:** Alert dialog with clear warnings about permanent data loss and master password requirement
- **Relationship Management:** Safely handles foreign key relationships by updating dependent records before deletion

### User Creation System Enhancement (July 2025)
- **Complete User Creation Form:** Fully functional form for creating users with all roles (admin, promotor, analista, indicador)
- **Field Organization:** Properly separated username (login email) and contact email fields for clarity
- **Password Requirements:** Mandatory password field with 6+ character validation for new users
- **Form Validation:** Comprehensive field validation including CPF, phone, email formats
- **Auto-fill Username:** System automatically uses email as username if not provided separately
- **Role Configuration:** Support for all user roles with appropriate permission settings
- **Form Reset:** Proper form reset after successful user creation
- **API Integration:** Confirmed working with backend API (successfully created multiple test users)

### Indicador Assignment System (July 2025)
- **Complete Assignment Interface:** Admin interface for assigning indicadores to promotores with modal dialog and visual feedback
- **Promoter Responsibility Column:** Added "Promotor Responsável" column in admin indicators table showing current assignments
- **Assignment/Unassignment API:** Full CRUD functionality for promoter assignments with automatic audit trail logging
- **Visual Status Indicators:** Clear visual distinction between assigned and unassigned indicadores in admin interface
- **Assignment Modal:** Interactive modal with promoter selection dropdown and assignment confirmation system
- **Database Integration:** Backend storage methods for indicator-promoter relationships with proper foreign key handling

### Landing Page Content Redesign (July 2025)
- **Authentic Content Integration:** Replaced AI-generated content with authentic program materials provided by client
- **Natural Language Approach:** Updated hero section with "Cadastrou, Validou é PIX! Simples assim" messaging
- **Realistic Program Details:** Integrated actual statistics (600+ active indicators, 13k daily registrations)
- **Authentic FAQ Section:** Replaced generic questions with real client FAQs including payment timing and program flexibility
- **Updated Value Propositions:** Focused on core benefits like immediate payment without sales requirement and kit provision
- **Process Clarity:** Updated 4-step process flow matching actual program operations
- **Target Audience Focus:** Emphasized content for frentistas, lava-jatos, despachantes, and panfleteiros
- **Earnings Transparency:** Highlighted R$5,000+ monthly earnings cases and R$1,980 potential with 30 daily cadastros

### Daily Counter System Clarification (July 2025)
- **Counter Function:** The daily counter (0/30) tracks referrals (leads/prospects), not indicators (new users)
- **System Design:** Two separate entities with distinct purposes:
  - Referrals = leads of people who need insurance (tracked by daily limit)
  - Indicators = new users/promoters registered in the system (not limited daily)
- **User Interface:** "Nova Indicação" page creates referrals, promoter dashboard creates indicators
- **Security System:** 30 daily limit applies only to insurance referrals, not user creation

### Complete Rebranding to Kong Pix (July 2025)
- **Brand Identity Transformation:** Complete migration from "Grupo Santana" to "Kong Pix" across entire platform
- **New Color Palette Implementation:** Updated primary colors to Kong Pix yellow (#fcb900) and secondary gray (#abb8c3)
- **CSS Theme Variables Updated:** Completely redesigned color system with proper HSL values for primary, secondary, and accent colors
- **Social Media Links Migration:** Updated footer links to new Kong Pix social media profiles
- **Privacy Policy Update:** All terms and legal documents updated with Kong Pix branding and contact information
- **System-Wide Text Replacement:** Replaced all references to "Santana" or "Grupo Santana" with "Kong Pix"
- **Footer Copyright Update:** Changed copyright attribution to Kong Pix with updated software registration codes
- **New Social Media Integration:**
  - Instagram: @kongprotecao
  - Facebook: kongprotecaoveicular
  - Official Website: kongprotecaoveicular.com.br
  - Contact Email: privacidade@kongprotecaoveicular.com.br
- **Logo Implementation:** New Kong Pix logo successfully integrated throughout the platform
- **Header Update:** Logo appears in header navigation across all pages with proper sizing and alignment
- **Brand Consistency:** Ensured consistent application of new branding across all user-facing components
- **Meta Tags Update:** Updated HTML title, description, and signature metadata to reflect Kong Pix branding

### Advanced Lead Security System (July 2025)
- **Comprehensive Lead Protection:** Implemented 4-layer security system to prevent fraud and ensure data integrity
- **Daily Limit Enforcement:** Maximum 30 referral registrations per user per day with real-time counter and visual progress bar
- **Duplicate Prevention System:** Automatic detection of duplicate phone numbers and license plates across the entire database
- **Duplicate Detection with Attribution:** Shows first name of original registrant when duplicates are found, with registration date
- **Minimum Withdrawal Protection:** R$ 10,00 minimum withdrawal amount to prevent micro-transactions abuse
- **Real-time Validation API:** Instant feedback system for users with clear error messages and prevention guidance
- **Visual Security Dashboard:** User interface shows daily usage statistics, security rules, and remaining capacity
- **Enhanced Error Reporting:** Detailed error messages with specific duplicate information and original registrant details
- **Database Optimization:** Efficient query system for duplicate checking with owner information joining
- **Frontend Integration:** Complete UI overhaul with security alerts, progress indicators, and educational information panels

### SMS Provider Migration to Comtele (July 2025)
- **Provider Change:** Migrated from Twilio to Comtele SMS service for better Brazilian market support
- **Comtele API Integration:** Implemented new SMS service using Comtele's REST API v2
- **API Configuration:**
  - Endpoint: https://sms.comtele.com.br/api/v2/send
  - Authentication: Header-based with auth-key
  - Sender ID: KongPix
- **Simplified Setup:** No phone number purchase required, works directly with Brazilian numbers
- **Automatic Number Formatting:** System automatically formats Brazilian phone numbers for Comtele
- **Updated Admin Interface:** SMS settings page updated to reflect Comtele configuration
- **Direct Brazilian Support:** Native support for all Brazilian carriers without international routing
- **Removed Dependencies:** Uninstalled Twilio package, reducing project dependencies

### Analyst User Creation System (July 23, 2025)
- **Full Implementation:** Complete system allowing analysts to create new indicadores and promotores with proper permissions
- **Permission-Based Access:** Analysts require specific permissions (create_indicadores, create_promotores) to create users
- **Dedicated Dashboard:** Created `/analyst` dashboard showing available actions based on analyst permissions and system overview
- **User Creation Pages:** Separate interfaces for creating indicadores (`/analyst/create-indicador`) and promotores (`/analyst/create-promotor`)
- **Role-Based Security:** Server routes force role assignment and prevent privilege escalation during user creation
- **Permission Validation:** Server middleware `requireAnalystPermission()` validates analyst permissions before user creation
- **SMS Integration:** New users created by analysts automatically receive welcome SMS via Comtele service
- **Navigation Integration:** Added analyst dashboard links in header navigation for authenticated analysts
- **Form Validation:** Complete form validation with required fields and proper data handling
- **Success Feedback:** Toast notifications confirm successful user creation with automatic redirect to analyst dashboard
- **Protected Routes:** `AnalystRoute` component ensures only authenticated analysts can access creation pages
- **API Endpoints:**
  - `POST /api/analyst/indicadores` - Create new indicador (requires create_indicadores permission)
  - `POST /api/analyst/promotores` - Create new promotor (requires create_promotores permission)

### Analyst Permissions Visibility System (July 24, 2025)
- **Permissions Page Created:** New dedicated page at `/analyst/permissions` for analysts to view their assigned permissions
- **Comprehensive Permission Display:** Shows all permissions with detailed descriptions, grouped by category (Visualização, Gestão, Criação de Usuários)
- **Visual Status Indicators:** Clear visual distinction between active and inactive permissions using checkmarks and badges
- **Analyst Information Card:** Displays analyst name, email, level (Junior/Pleno/Senior), and total permission count
- **Navigation Integration:** Added "Ver Detalhes das Permissões" button in analyst dashboard for easy access
- **Role-Based Access:** Page only accessible to authenticated analysts through AnalystRoute protection
- **Permission Grouping:** Organized permissions into logical groups for better understanding
- **Summary Section:** Quick overview of all active capabilities in one place
- **Empty State Handling:** Clear message when no permissions are assigned with instructions to contact administrator

### Critical Password Security Fix (July 23, 2025)
- **Security Issue Identified:** Users created through admin and analyst interfaces had passwords stored in plain text, making login impossible
- **Comprehensive Fix Applied:** Updated all user creation routes to properly hash passwords using scrypt-based hashPassword function
- **Routes Fixed:**
  - `POST /api/admin/users` - Admin user creation now hashes passwords
  - `POST /api/analyst/indicadores` - Analyst indicador creation now hashes passwords  
  - `POST /api/analyst/promotores` - Analyst promotor creation now hashes passwords
  - `POST /api/promoter/indicators` - Promoter indicador creation now hashes passwords
- **Existing Routes Verified:** Public registration (`/api/register`), password change (`/api/change-password`), and admin password reset (`/api/admin/users/:id/reset-password`) already properly hash passwords
- **Database Schema Updates:** Enhanced address fields separation (city, state, zipCode) with proper TypeScript typing
- **Enhanced Duplicate Detection:** License plate duplicates now show first name and state of original owner
- **LSP Error Resolution:** Fixed all TypeScript compilation errors related to user role typing and database insertions
- **Testing Status:** All user creation flows now working with proper password authentication

### Analyst Referral Viewing System (July 24, 2025)
- **New Capability:** Analysts can now view and validate referrals for quality control
- **API Route Created:** `GET /api/analyst/referrals` - Returns all referrals for analysts with view_referrals permission
- **Permission Check:** Route verifies analyst has "view_referrals" permission before granting access
- **Dedicated Interface:** Created `/analyst/referrals` page with comprehensive referral management
- **Validation Features:** Analysts with "edit_referral_status" permission can validate referrals with vehicle details
- **Filtering System:** Search by name, phone, or license plate with status-based filtering
- **Validation Form:** Captures vehicle brand, model, year and validates data accuracy
- **Status Management:** Analysts can mark referrals as validated or rejected with notes
- **Security:** Role-based access control ensures only authorized analysts can view/edit referrals
- **Navigation Update:** Updated analyst dashboard to link to new referrals page instead of admin page

### Address Fields Persistence Fix (July 25, 2025)
- **Issue Fixed:** City, state, and ZIP code fields were not being saved properly in user profiles
- **Root Cause:** The updateUserProfile method wasn't reconstructing the address field from individual components
- **Solution Implemented:** Modified server/storage.ts to automatically reconstruct address field when city, state, or zipCode are updated
- **Form Update:** Updated admin-profiles.tsx to properly populate city, state, and zipCode fields when editing existing users
- **Data Format:** Address is stored as "city, state - zipCode" format for backward compatibility
- **Affected Areas:** Admin user profile management and all user creation/update endpoints