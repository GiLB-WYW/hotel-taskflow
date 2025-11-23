# Hôtel TaskFlow

## Overview

Hôtel TaskFlow is an AI-enhanced hotel maintenance management system designed as a Progressive Web Application (PWA). The application streamlines maintenance task management for hotel staff through an innovative voice-first interface that supports multilingual input. Staff can create maintenance tasks by speaking in any language and taking photos, while AI automatically translates, summarizes, and categorizes the information.

The system features role-based access control (Admin, Manager, Personnel, Basic Staff), real-time task tracking with priority-based workflows, and comprehensive reporting capabilities. Built with modern web technologies, it supports offline functionality and can be installed on mobile devices for on-the-go maintenance management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query for server state management and caching
- Tailwind CSS v4 for styling with shadcn/ui component library (New York variant)
- Progressive Web App capabilities via service workers

**Design Patterns:**
- Component-based architecture with reusable UI components from shadcn/ui
- Custom hooks for shared logic (useToast, useIsMobile)
- Layout wrapper pattern for consistent page structure
- Client-side routing with role-based route protection
- Offline-first design with local storage for authentication state

**Key Features:**
- Voice-to-text interface for multilingual task creation (Web Speech API)
- Camera integration for photo attachments
- Responsive mobile-first design
- Real-time filtering and search across tasks and locations
- PDF export functionality for maintenance reports (jsPDF, html2canvas)

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js framework
- TypeScript throughout the backend
- Drizzle ORM for database operations
- PostgreSQL as the primary database (via Neon serverless)
- bcrypt for password hashing and authentication

**API Design:**
- RESTful API endpoints under `/api` prefix
- JSON request/response format
- Session-based or JWT authentication (implementation in progress)
- Role-based authorization middleware

**Database Schema:**
- **Users Table**: Stores user accounts with roles (Admin, Manager, Personnel, Basic Staff), authentication providers (email, OAuth), and group assignments
- **Locations Table**: Hotel locations organized by categories (Restaurant, Suites, Technical areas) with unique codes for quick reference
- **Maintenance Groups Table**: Team assignments (Plomberie, Électricité, Ménage, Général, Piscine) with member counts
- **Tasks Table**: Maintenance tasks with multilingual support fields (originalTranscript, detectedLanguage), priority levels (Red Flag, High, Normal, Low), status tracking (Open, In Progress, Resolved), photo attachments, and assignment tracking

**Key Architectural Decisions:**
- Separate development and production server entry points (index-dev.ts, index-prod.ts)
- Database migrations managed through Drizzle Kit
- Seed data for initial setup with demo users and locations
- Storage abstraction layer for database operations (IStorage interface)

### Authentication & Authorization

**Authentication Methods:**
- Email/password authentication with bcrypt hashing (10 salt rounds)
- OAuth provider support (Google, Microsoft) - infrastructure in place
- Password reset functionality

**Authorization:**
- Role-based access control with four distinct roles
- Admin: Full system control including user and location management
- Manager: Task creation, assignment, and status management
- Personnel: View assigned tasks and update status to In Progress/Resolved
- Basic Staff: Create new tasks only via voice/photo workflow

**Session Management:**
- Client-side user data stored in localStorage
- Server-side session validation (implementation details in routes.ts)

### AI Integration Workflow

**Task Creation Pipeline:**
1. Staff records voice message in any language and captures photo
2. Speech-to-Text converts audio to text (Web Speech API)
3. AI translates text to application default language
4. AI generates concise task title/summary from translated content
5. System auto-populates task form with location, photo, description, and AI-generated title
6. Staff selects priority and confirms submission

**Benefits:**
- Reduces manual data entry
- Eliminates language barriers for multilingual staff
- Improves task clarity through AI summarization
- Speeds up task creation process

### Progressive Web App Features

**PWA Capabilities:**
- Installable on mobile devices via manifest.json
- Offline mode support through Service Workers
- IndexedDB for local data caching
- Background sync for pending operations

**Mobile Optimization:**
- Touch-friendly interface with appropriate sizing
- Responsive breakpoints for different screen sizes
- Mobile-first component design
- Camera and microphone API integration

## External Dependencies

### Third-Party Services

**Database:**
- Neon Serverless PostgreSQL: Cloud-hosted PostgreSQL database
- Connection via `@neondatabase/serverless` driver
- Environment variable: `DATABASE_URL`

**Planned AI Services:**
- Speech-to-Text API (Web Speech API or cloud service)
- Translation API for multilingual support
- Text summarization for task title generation

### Key NPM Packages

**UI Framework:**
- Radix UI primitives for accessible components
- Tailwind CSS for utility-first styling
- Lucide React for icons
- class-variance-authority for component variants

**Data Management:**
- @tanstack/react-query for server state
- drizzle-orm and drizzle-kit for database operations
- zod for schema validation

**Authentication:**
- bcrypt for password hashing
- connect-pg-simple for session storage (optional)

**Utilities:**
- date-fns for date formatting
- jspdf and html2canvas for PDF generation
- nanoid for ID generation

### Development Tools

**Replit-Specific:**
- @replit/vite-plugin-runtime-error-modal
- @replit/vite-plugin-cartographer
- @replit/vite-plugin-dev-banner

**Build Tools:**
- Vite for bundling and development
- esbuild for server-side bundling
- tsx for TypeScript execution

### Configuration Notes

- Custom Vite plugin (vite-plugin-meta-images.ts) for dynamic OpenGraph image handling
- Path aliases configured for clean imports (@/, @shared/, @assets/)
- TypeScript strict mode enabled
- PostCSS with Tailwind and Autoprefixer