# Project Overview

## Project Name

Electron Market

## Project Goal

Create a modern web application for an electronics marketplace.

The system should help buyers find electronic products, create RFQ requests, send requests to suppliers, communicate with suppliers, and manage order-related information.

The project will be created from scratch.

## Main Concept

Electron Market is a marketplace and RFQ platform for electronics products.

The platform should include:

- product categories
- product listings
- buyer accounts
- supplier accounts
- RFQ requests
- RFQ items
- supplier responses
- messages between buyers and suppliers
- admin management
- future AI assistant for product and RFQ consultation

## Target Technologies

Frontend:
- Next.js
- TypeScript

Backend:
- Node.js

Database:
- Supabase
- PostgreSQL

Future Android App:
- Capacitor after the web version is working

Future AI Features:
- AI assistant for buyers
- AI analysis of RFQ requests
- AI help for product matching
- AI support for supplier communication

## First Development Stage

Do not build the full system at once.

The first development stage should implement only one working module:

RFQ module.

## First Module to Build

Module name:
RFQ module

The RFQ module should include:

- RFQ list screen
- Create RFQ screen
- RFQ detail screen
- Add RFQ item functionality
- RFQ messages section
- Basic buyer role
- Basic supplier role
- Basic admin role

## Main User Roles

Buyer:
- creates RFQ requests
- adds products/items to RFQ
- sends RFQ to suppliers
- communicates with suppliers
- views RFQ status

Supplier:
- receives RFQ requests
- views assigned RFQ requests
- sends responses
- communicates with buyers

Admin:
- views all users
- views all RFQ requests
- manages system data
- manages categories and suppliers

## Important Development Rule

Do not build the full system at once.

Build the project step by step.

First build only the RFQ module. After it works correctly, other modules can be added later.

## General Design Direction

The interface should be:

- clean
- modern
- mobile-friendly
- suitable for future Android packaging through Capacitor
- suitable for a B2B electronics marketplace

The application should be fast and should avoid the performance problems of no-code mobile applications.

## Future Modules

After the RFQ module is completed, the following modules can be added:

- product catalog
- supplier catalog
- buyer dashboard
- supplier dashboard
- admin dashboard
- product categories
- file uploads
- email notifications
- AI consultant
- order management
- payment integration
