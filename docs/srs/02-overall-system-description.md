<!-- Extracted from SRS V2.4. Master copy is the DOCX; regenerate rather than hand-edit. -->

# 2. Overall System Description

## 2.1 Product Perspective

The platform moves from being middleware that integrates with external websites to being a one-stop standalone booking platform. It covers three scenarios: consumers browsing and booking, merchants managing their operations, and the platform operator exercising global control. The BNPL model of booking first and paying later is retained, with catalogue publishing, search and browse, and multi-channel booking added on top.

The architecture uses one backend core with multiple client surfaces. All business logic sits in a single backend service, and the three web surfaces, the mobile application and the WhatsApp channel all call the same API. This avoids duplicated development and inconsistent data.

The platform includes a customer credit tiering mechanism which reduces the risk that operators hold inventory for bookings that are never paid. This is the core differentiator of the BNPL model and is treated as a first-class subsystem rather than an add-on.

## 2.2 User Roles and Organisation Model

The platform uses a three-level account, organisation and role architecture. The users table holds login accounts, the operators table holds merchant organisations, and the two are linked through operator_members which also assigns the role held within that merchant. Platform-level roles are managed separately, which keeps a single source of truth for every permission decision.

| Role Level | Role | Authority | Core Responsibilities |
| --- | --- | --- | --- |
| Platform | Customer | Lowest | Browse packages, submit bookings, complete payments, view orders, use self-service support, view own credit record and submit appeals |
| Platform | Administrator | Highest | Manage operator accounts, configure global platform rules, monitor platform-wide operations, audit sensitive actions, manage marketing campaigns, review credit appeals |
| Operator | Operator Manager | Highest within merchant | Manage staff accounts, view all shop data, configure financial and settlement rules, manage listings and orders |
| Operator | Operator Staff | Standard within merchant | Manage listing inventory, process daily orders, review cancellation requests, mark no-shows, view operational reports |
| System | System | Not applicable | Scheduled task execution, automated notifications, payment callback handling, inventory validation, credit score computation |

## 2.3 Assumptions and Dependencies

- The technology stack remains within the existing JavaScript ecosystem, maximising reuse of Phase 1 code and the team’s existing skills
- The production environment moves from Vercel to DigitalOcean, replacing the previous serverless deployment
- Stripe is the primary online payment channel and Stripe Connect provides multi-merchant settlement; DuitNow is supported through manual receipt verification
- The AI chatbot uses a third-party LLM API. No language model is trained or hosted by the team
- WhatsApp Business API depends on Meta account review and template approval, and the timeline is outside the team’s control
- The target market is Malaysia and the platform must comply with the PDPA
- The SARIMA model can produce demand forecasts and pricing suggestions from historical booking data once sufficient history exists

