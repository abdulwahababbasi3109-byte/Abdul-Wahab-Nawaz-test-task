AI Chat & Subscription Bundles API

This is a backend built with NestJS, TypeScript and PostgreSQL, using Prisma as the ORM. It has two independent modules: a chat module and a subscriptions module.


Running the project

You need Node 20 or newer and Docker. Install the dependencies and copy .env.example to .env. Start the database with "npm run db:up", which runs Postgres in Docker on port 5433. Create the tables with "npx prisma migrate deploy", then run "npm run prisma:seed" to create two test users. The seed prints their ids. Finally start the API with "npm run start:dev". It runs on http://localhost:3000/api/v1.

There is no login. Every request identifies the user with the x-user-id header, using one of the ids the seed printed.


Endpoints

POST /api/v1/chat/messages sends a question and returns the AI answer.

POST /api/v1/subscriptions creates a subscription. The body takes a tier (BASIC, PRO or ENTERPRISE), a billingCycle (MONTHLY or YEARLY) and an optional autoRenew flag, which defaults to true.

PATCH /api/v1/subscriptions/:id/auto-renew turns auto-renew on or off.

POST /api/v1/subscriptions/:id/cancel cancels a subscription.


Chat module

When a user asks a question, a mocked OpenAI service waits a random 500 to 1500 milliseconds, like a real API call, and then returns an answer. The question, the answer and the token counts are saved in the database.

Each user gets 3 free messages per month, and these are always used first. After that, each message is taken from the user's newest active bundle that still has messages left. When that bundle runs out, older bundles are used. A Basic bundle has 10 messages, Pro has 100 and Enterprise is unlimited. A user can have several active bundles at the same time.

Free usage is stored separately for each month, so it resets on the 1st of every month without any scheduled job, and past months stay as history. If a user has no free messages left and no usable bundle, the API returns a 402 error with the code QUOTA_EXCEEDED and the date the free quota resets.

Taking a message from the quota and saving the chat happen together in one database transaction that locks the user's usage row. Many requests sent at the same moment can never go over the limit.


Subscriptions module

Each subscription stores its tier, billing cycle, maxMessages, price, startDate, endDate and renewalDate. Monthly prices are 9.99 for Basic, 29.99 for Pro and 99.99 for Enterprise. Yearly prices are 99.90, 299.90 and 999.90. The message limit applies to each billing cycle.

Payments are simulated and fail at random 20% of the time. This can be changed with PAYMENT_FAILURE_RATE in the .env file. If the payment fails when a subscription is created, the subscription is not saved and the API returns a 402 error with the code PAYMENT_FAILED.

A background job runs every 10 minutes and looks for subscriptions whose end date has passed. If auto-renew is on and the payment succeeds, the subscription is renewed for another cycle and its message count starts again from zero. If the payment fails, it is marked inactive. If auto-renew is off, it simply expires and is marked inactive.

Cancelling a subscription ends it immediately, turns off auto-renew so it is never renewed, and marks it as cancelled. The subscription and all chat messages linked to it stay in the database, so the usage history is preserved.


Errors

Every error has the same format: a statusCode, and an error object with a code, a readable message and extra details. The error codes are VALIDATION_ERROR (400), MISSING_USER_ID (401), USER_NOT_FOUND (404), QUOTA_EXCEEDED (402), PAYMENT_FAILED (402), SUBSCRIPTION_NOT_FOUND (404) and SUBSCRIPTION_NOT_ACTIVE (409).


Project structure

The code is in src/modules, with one folder for chat and one for subscriptions. Both use the same layers. Controllers handle the HTTP routes, services hold the business logic, repositories run the database queries, entities describe the domain objects, dto handles request validation and response shapes, and errors holds the domain errors. Shared code, such as the error filter and the x-user-id guard, is in src/common.

The chat module only talks to the subscriptions module through one service, BundleUsageService, so the two modules stay independent.

The database has four tables. users holds the people using the API. chat_messages stores each question and answer with its token counts. monthly_usages counts free messages per user per month. subscription_bundles stores the bundles users have bought. The tables are defined in prisma/schema.prisma and created by the migrations in prisma/migrations.


Tests and tooling

Run the end-to-end tests with "npm run test:e2e". They use a separate test database and cover every requirement: the free quota, the monthly reset, the order bundles are used in, unlimited Enterprise, many requests at the same time, validation, creating, toggling and cancelling subscriptions, and renewals, failed payments and expiry. ESLint and Prettier are configured, and can be run with "npm run lint" and "npm run format".
